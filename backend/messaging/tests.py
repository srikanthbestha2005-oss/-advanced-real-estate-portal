from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model
from properties.models import Property
from .models import Conversation, Message

User = get_user_model()

class MessagingTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner', email='owner@test.com', password='pass', role='USER')
        self.customer = User.objects.create_user(username='customer', email='customer@test.com', password='pass', role='USER')
        self.other_user = User.objects.create_user(username='other', email='other@test.com', password='pass', role='USER')
        
        self.property = Property.objects.create(
            owner=self.owner,
            title="Test Property",
            description="Test",
            property_type="APARTMENT",
            listing_type="SALE",
            price=1000,
            area=100,
            address="123 Test St",
            city="Test City",
            state="Test State",
            pincode="123456"
        )
        
        self.list_create_url = reverse('conversation-list-create')

    def test_start_conversation_success(self):
        # 1. Authenticated customer can start a conversation.
        self.client.force_authenticate(user=self.customer)
        response = self.client.post(self.list_create_url, {"property_id": self.property.id})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Conversation.objects.count(), 1)
        
    def test_start_conversation_repeated_returns_existing(self):
        # 2. Repeated requests return the existing conversation where appropriate.
        self.client.force_authenticate(user=self.customer)
        self.client.post(self.list_create_url, {"property_id": self.property.id})
        response = self.client.post(self.list_create_url, {"property_id": self.property.id})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(Conversation.objects.count(), 1)
        
    def test_send_and_read_message(self):
        # 3. Customer can send a message.
        self.client.force_authenticate(user=self.customer)
        conv_res = self.client.post(self.list_create_url, {"property_id": self.property.id})
        conv_id = conv_res.data['id']
        
        msg_url = reverse('message-list-create', kwargs={'conversation_id': conv_id})
        msg_res = self.client.post(msg_url, {"content": "Hello!"})
        self.assertEqual(msg_res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Message.objects.count(), 1)
        
        # 4. Owner can read the message.
        self.client.force_authenticate(user=self.owner)
        read_res = self.client.get(msg_url)
        self.assertEqual(read_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(read_res.data), 1)
        # 14. Read/unread behavior works if implemented.
        msg = Message.objects.first()
        self.assertTrue(msg.is_read) # GET automatically marks as read
        
        # 5. Owner can reply.
        reply_res = self.client.post(msg_url, {"content": "Hi there."})
        self.assertEqual(reply_res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Message.objects.count(), 2)

    def test_cannot_read_others_conversation(self):
        # 6. A user cannot read another user's conversation.
        Conversation.objects.create(customer=self.customer, owner=self.owner, property=self.property)
        conv_id = Conversation.objects.first().id
        
        self.client.force_authenticate(user=self.other_user)
        msg_url = reverse('message-list-create', kwargs={'conversation_id': conv_id})
        response = self.client.get(msg_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        
    def test_cannot_send_to_others_conversation(self):
        # 7. A user cannot send a message into another user's conversation.
        Conversation.objects.create(customer=self.customer, owner=self.owner, property=self.property)
        conv_id = Conversation.objects.first().id
        
        self.client.force_authenticate(user=self.other_user)
        msg_url = reverse('message-list-create', kwargs={'conversation_id': conv_id})
        response = self.client.post(msg_url, {"content": "Sneaky"})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        
    def test_client_cannot_spoof_sender(self):
        # 8. A client cannot spoof the sender.
        self.client.force_authenticate(user=self.customer)
        conv = Conversation.objects.create(customer=self.customer, owner=self.owner, property=self.property)
        msg_url = reverse('message-list-create', kwargs={'conversation_id': conv.id})
        
        # DRF automatically assigns the authenticated user in our view
        response = self.client.post(msg_url, {"content": "Hi", "sender": self.owner.id})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        msg = Message.objects.first()
        self.assertEqual(msg.sender, self.customer)
        
    def test_client_cannot_select_arbitrary_recipient(self):
        # 9. A client cannot select an arbitrary recipient.
        # Derived from property
        self.client.force_authenticate(user=self.customer)
        response = self.client.post(self.list_create_url, {"property_id": self.property.id, "owner": self.other_user.id})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        conv = Conversation.objects.first()
        self.assertEqual(conv.owner, self.owner)
        
    def test_cannot_message_self(self):
        # 10. A user cannot message themselves about their own property.
        self.client.force_authenticate(user=self.owner)
        response = self.client.post(self.list_create_url, {"property_id": self.property.id})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        
    def test_empty_messages_rejected(self):
        # 11. Empty messages are rejected.
        self.client.force_authenticate(user=self.customer)
        conv = Conversation.objects.create(customer=self.customer, owner=self.owner, property=self.property)
        msg_url = reverse('message-list-create', kwargs={'conversation_id': conv.id})
        response = self.client.post(msg_url, {"content": "   "})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        
    def test_invalid_property_id(self):
        # 12. Invalid property IDs are handled correctly.
        self.client.force_authenticate(user=self.customer)
        response = self.client.post(self.list_create_url, {"property_id": 9999})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        
    def test_unauthenticated_requests_rejected(self):
        # 13. Unauthenticated requests are rejected.
        response = self.client.post(self.list_create_url, {"property_id": self.property.id})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
