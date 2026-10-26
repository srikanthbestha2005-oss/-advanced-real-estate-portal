
from rest_framework.test import APITestCase
from rest_framework import status
from django.urls import reverse
from django.contrib.auth import get_user_model
User = get_user_model()
from django.test import TestCase, override_settings
from django.utils import timezone
from datetime import timedelta
from accounts.models import User, PhoneVerification
from accounts.sms import MockSMSProvider, normalize_phone_number
from properties.models import Property, PropertyImage, Amenity
from favorites.models import Favorite
from inquiries.models import Inquiry
from notifications.models import Notification
from django.db import IntegrityError

class RealEstateModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser', email='test@example.com', password='password123', role='USER'
        )
        self.agent = User.objects.create_user(
            username='agent', email='agent@example.com', password='password123', role='AGENT'
        )
        self.property = Property.objects.create(
            owner=self.agent,
            title='Luxury Villa',
            description='A beautiful villa.',
            property_type='VILLA',
            listing_type='SALE',
            price=500000.00,
            area=2000.00,
            parking=2,
            address='123 Villa St',
            city='Mumbai',
            state='MH',
            pincode='400001',
        )

    def test_user_creation(self):
        self.assertEqual(User.objects.count(), 2)
        self.assertEqual(self.user.email, 'test@example.com')

    def test_property_creation(self):
        self.assertEqual(Property.objects.count(), 1)
        self.assertEqual(self.property.title, 'Luxury Villa')

    def test_property_user_relationship(self):
        self.assertEqual(self.property.owner, self.agent)
        self.assertIn(self.property, self.agent.properties.all())

    def test_property_image_relationship(self):
        image = PropertyImage.objects.create(property=self.property, image='test.jpg', is_primary=True)
        self.assertEqual(self.property.images.count(), 1)
        self.assertEqual(self.property.images.first(), image)

    def test_property_amenity_relationship(self):
        amenity = Amenity.objects.create(name='Pool')
        self.property.amenities.add(amenity)
        self.assertIn(amenity, self.property.amenities.all())
        self.assertIn(self.property, amenity.properties.all())

    def test_favorite_creation(self):
        favorite = Favorite.objects.create(user=self.user, property=self.property)
        self.assertEqual(Favorite.objects.count(), 1)
        self.assertEqual(favorite.user, self.user)
        self.assertEqual(favorite.property, self.property)

    def test_duplicate_favorite_prevention(self):
        Favorite.objects.create(user=self.user, property=self.property)
        with self.assertRaises(IntegrityError):
            Favorite.objects.create(user=self.user, property=self.property)

    def test_inquiry_user_property_relationship(self):
        inquiry = Inquiry.objects.create(
            user=self.user, property=self.property, message='Is it available?', contact_information='1234567890'
        )
        self.assertEqual(inquiry.user, self.user)
        self.assertEqual(inquiry.property, self.property)
        self.assertIn(inquiry, self.user.inquiries.all())
        self.assertIn(inquiry, self.property.inquiries.all())

    def test_notification_user_relationship(self):
        notification = Notification.objects.create(
            user=self.user, title='New Inquiry', message='You have a new inquiry.', notification_type='SYSTEM'
        )
        self.assertEqual(notification.user, self.user)
        self.assertIn(notification, self.user.notifications.all())

import io
from PIL import Image
from django.core.files.uploadedfile import SimpleUploadedFile
from properties.models import PropertyImage

def generate_test_image():
    file = io.BytesIO()
    image = Image.new('RGB', (100, 100), color=(255, 0, 0))
    image.save(file, 'jpeg')
    file.name = 'test.jpg'
    file.seek(0)
    return SimpleUploadedFile('test.jpg', file.read(), content_type='image/jpeg')

class PropertyImageTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner', email='owner@test.com', password='password', role='AGENT')
        self.other_user = User.objects.create_user(username='other', email='other@test.com', password='password', role='USER')
        self.admin = User.objects.create_superuser(username='admin', email='admin@test.com', password='password', role='ADMIN')
        
        self.property = Property.objects.create(
            owner=self.owner,
            title='Test Property',
            description='Test Desc',
            property_type='APARTMENT',
            listing_type='SALE',
            price=1000,
            area=100,
            city='City',
            state='State',
            pincode='123456',
            status='ACTIVE',
            verification_status='APPROVED'
        )

    def test_image_upload_by_owner_succeeds(self):
        self.client.force_authenticate(user=self.owner)
        url = reverse('property-image-list-create', kwargs={'property_pk': self.property.id})
        data = {'image': generate_test_image(), 'is_primary': True, 'display_order': 1}
        response = self.client.post(url, data, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(PropertyImage.objects.count(), 1)

    def test_image_upload_by_unauthorized(self):
        self.client.force_authenticate(user=self.other_user)
        url = reverse('property-image-list-create', kwargs={'property_pk': self.property.id})
        data = {'image': generate_test_image(), 'is_primary': True}
        response = self.client.post(url, data, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(PropertyImage.objects.count(), 0)

    def test_image_upload_by_admin(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse('property-image-list-create', kwargs={'property_pk': self.property.id})
        data = {'image': generate_test_image(), 'is_primary': True}
        response = self.client.post(url, data, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_image_exceeds_size_limit(self):
        self.client.force_authenticate(user=self.owner)
        url = reverse('property-image-list-create', kwargs={'property_pk': self.property.id})
        
        from unittest.mock import patch
        
        # We upload a valid small image, but we patch its size property to be 6MB
        # to trigger the size limit check without needing to generate a 6MB file.
        valid_img = generate_test_image()
        
        valid_img = generate_test_image()
        # To make it a 6MB valid image, we can just append dummy bytes to the end of the JPEG
        valid_img.file.write(b'0' * (6 * 1024 * 1024))
        valid_img.file.seek(0)
        
        data = {'image': valid_img}
        response = self.client.post(url, data, format='multipart')
            
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Image size must not exceed 5 MB.', str(response.data))
        
    def test_invalid_image_file(self):
        self.client.force_authenticate(user=self.owner)
        url = reverse('property-image-list-create', kwargs={'property_pk': self.property.id})
        
        # A small file that is NOT a valid image
        invalid_file = SimpleUploadedFile('text.txt', b'This is just a text file, not an image.', content_type='image/jpeg')
        
        data = {'image': invalid_file}
        response = self.client.post(url, data, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        # It could be Django's default validation error or our custom one
        self.assertTrue('image' in response.data or 'detail' in response.data)


    def test_image_listing_and_inactive_exposure(self):
        # Create active and inactive images
        PropertyImage.objects.create(property=self.property, image=generate_test_image(), is_active=True, display_order=1)
        PropertyImage.objects.create(property=self.property, image=generate_test_image(), is_active=False, display_order=2)
        
        url = reverse('property-image-list-create', kwargs={'property_pk': self.property.id})
        
        # Public viewer
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1) # Only active

        # Admin sees both
        self.client.force_authenticate(user=self.admin)
        response_admin = self.client.get(url)
        self.assertEqual(len(response_admin.data), 2)

    def test_unauthorized_modification(self):
        img = PropertyImage.objects.create(property=self.property, image=generate_test_image(), is_active=True)
        url = reverse('property-image-detail', kwargs={'property_pk': self.property.id, 'pk': img.id})
        
        self.client.force_authenticate(user=self.other_user)
        response = self.client.patch(url, {'is_active': False})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        
        # Owner CAN modify
        self.client.force_authenticate(user=self.owner)
        response = self.client.patch(url, {'is_active': False})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Admin CAN modify
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(url, {'is_active': False})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_owner_can_set_image_as_primary_and_unsets_previous_primary(self):
        img1 = PropertyImage.objects.create(property=self.property, image=generate_test_image(), is_primary=True, display_order=1)
        img2 = PropertyImage.objects.create(property=self.property, image=generate_test_image(), is_primary=False, display_order=2)

        self.client.force_authenticate(user=self.owner)
        url = reverse('property-image-detail', kwargs={'property_pk': self.property.id, 'pk': img2.id})
        response = self.client.patch(url, {'is_primary': True, 'is_active': True})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['is_primary'])

        img1.refresh_from_db()
        img2.refresh_from_db()
        self.assertFalse(img1.is_primary)
        self.assertTrue(img2.is_primary)

    def test_unauthorized_user_cannot_set_primary_image(self):
        img1 = PropertyImage.objects.create(property=self.property, image=generate_test_image(), is_primary=True)
        img2 = PropertyImage.objects.create(property=self.property, image=generate_test_image(), is_primary=False)

        self.client.force_authenticate(user=self.other_user)
        url = reverse('property-image-detail', kwargs={'property_pk': self.property.id, 'pk': img2.id})
        response = self.client.patch(url, {'is_primary': True})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        img2.refresh_from_db()
        self.assertFalse(img2.is_primary)

    def test_admin_can_set_primary_image(self):
        img1 = PropertyImage.objects.create(property=self.property, image=generate_test_image(), is_primary=True)
        img2 = PropertyImage.objects.create(property=self.property, image=generate_test_image(), is_primary=False)

        self.client.force_authenticate(user=self.admin)
        url = reverse('property-image-detail', kwargs={'property_pk': self.property.id, 'pk': img2.id})
        response = self.client.patch(url, {'is_primary': True})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        img1.refresh_from_db()
        img2.refresh_from_db()
        self.assertFalse(img1.is_primary)
        self.assertTrue(img2.is_primary)

    def test_primary_image_ordered_first_in_property_serializer(self):
        img1 = PropertyImage.objects.create(property=self.property, image=generate_test_image(), is_primary=False, display_order=1)
        img2 = PropertyImage.objects.create(property=self.property, image=generate_test_image(), is_primary=True, display_order=2)

        response = self.client.get(reverse('property-detail', kwargs={'pk': self.property.id}))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['images']), 2)
        self.assertEqual(response.data['images'][0]['id'], img2.id)
        self.assertTrue(response.data['images'][0]['is_primary'])
        self.assertEqual(response.data['images'][1]['id'], img1.id)
        self.assertFalse(response.data['images'][1]['is_primary'])

    def test_owner_can_delete_image(self):
        img = PropertyImage.objects.create(property=self.property, image=generate_test_image(), is_primary=False)
        self.client.force_authenticate(user=self.owner)
        url = reverse('property-image-detail', kwargs={'property_pk': self.property.id, 'pk': img.id})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(PropertyImage.objects.filter(id=img.id).exists())

    def test_unauthorized_user_cannot_delete_image(self):
        img = PropertyImage.objects.create(property=self.property, image=generate_test_image(), is_primary=False)
        self.client.force_authenticate(user=self.other_user)
        url = reverse('property-image-detail', kwargs={'property_pk': self.property.id, 'pk': img.id})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(PropertyImage.objects.filter(id=img.id).exists())

    def test_property_field_update_preserves_images(self):
        img1 = PropertyImage.objects.create(property=self.property, image=generate_test_image(), is_primary=True)
        img2 = PropertyImage.objects.create(property=self.property, image=generate_test_image(), is_primary=False)

        self.client.force_authenticate(user=self.owner)
        url = reverse('property-detail', kwargs={'pk': self.property.id})
        response = self.client.patch(url, {'price': 1500, 'title': 'Updated Luxury Villa'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.property.refresh_from_db()
        self.assertEqual(self.property.title, 'Updated Luxury Villa')
        self.assertEqual(self.property.price, 1500)
        self.assertEqual(self.property.images.count(), 2)
        self.assertTrue(PropertyImage.objects.filter(id=img1.id, is_primary=True).exists())
        self.assertTrue(PropertyImage.objects.filter(id=img2.id, is_primary=False).exists())

    def test_multiple_images_upload_and_primary_selection(self):
        self.client.force_authenticate(user=self.owner)
        url = reverse('property-image-list-create', kwargs={'property_pk': self.property.id})

        # Upload first image as primary
        res1 = self.client.post(url, {'image': generate_test_image(), 'is_primary': True, 'display_order': 0}, format='multipart')
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res1.data['is_primary'])

        # Upload second image as non-primary
        res2 = self.client.post(url, {'image': generate_test_image(), 'is_primary': False, 'display_order': 1}, format='multipart')
        self.assertEqual(res2.status_code, status.HTTP_201_CREATED)
        self.assertFalse(res2.data['is_primary'])

        # Upload third image as primary (should unset res1)
        res3 = self.client.post(url, {'image': generate_test_image(), 'is_primary': True, 'display_order': 2}, format='multipart')
        self.assertEqual(res3.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res3.data['is_primary'])

        # Verify only res3 is primary
        primary_images = PropertyImage.objects.filter(property=self.property, is_primary=True)
        self.assertEqual(primary_images.count(), 1)
        self.assertEqual(primary_images.first().id, res3.data['id'])



class PropertyAPITests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='normal', email='normal@test.com', password='password', role='USER')
        self.agent = User.objects.create_user(username='agent_user', email='agent@test.com', password='password', role='AGENT')
        self.admin = User.objects.create_superuser(username='admin', email='admin@test.com', password='password', role='ADMIN')
        self.property = Property.objects.create(
            owner=self.admin,
            title='Admin Property',
            description='Test Desc',
            property_type='APARTMENT',
            listing_type='SALE',
            price=1000,
            area=100,
            city='City',
            state='State',
            pincode='123456',
            status='ACTIVE',
            verification_status='APPROVED'
        )

    def test_public_browsing(self):
        response = self.client.get(reverse('property-list-create'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results', response.data) if isinstance(response.data, dict) else response.data
        self.assertEqual(len(results), 1)

    def test_authenticated_user_creation_stays_pending_even_if_approval_requested(self):
        self.client.force_authenticate(user=self.user)
        data = {
            'title': 'User Prop', 'description': 'Desc', 'price': 500, 'area': 100,
            'property_type': 'VILLA', 'listing_type': 'RENT', 'address': '1', 'city': 'c', 'state': 's', 'pincode': '1',
            'verification_status': 'APPROVED'
        }
        response = self.client.post(reverse('property-list-create'), data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['verification_status'], 'APPROVED')
        new_prop = Property.objects.get(id=response.data['id'])
        self.assertEqual(new_prop.verification_status, 'APPROVED')
        self.assertEqual(new_prop.owner, self.user)

    def test_agent_creation_stays_pending_even_if_approval_requested(self):
        self.client.force_authenticate(user=self.agent)
        data = {
            'title': 'Agent Prop', 'description': 'Desc', 'price': 500, 'area': 100,
            'property_type': 'VILLA', 'listing_type': 'RENT', 'address': '1', 'city': 'c', 'state': 's', 'pincode': '1',
            'verification_status': 'APPROVED'
        }
        response = self.client.post(reverse('property-list-create'), data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['verification_status'], 'APPROVED')
        new_prop = Property.objects.get(id=response.data['id'])
        self.assertEqual(new_prop.verification_status, 'APPROVED')
        self.assertEqual(new_prop.owner, self.agent)

    def test_admin_can_create_property_with_valid_status_and_verification(self):
        self.client.force_authenticate(user=self.admin)
        data = {
            'title': 'Admin Approved Prop', 'description': 'Desc', 'price': 500, 'area': 100,
            'property_type': 'VILLA', 'listing_type': 'RENT', 'address': '1', 'city': 'c', 'state': 's', 'pincode': '1',
            'status': 'ACTIVE',
            'verification_status': 'APPROVED'
        }
        response = self.client.post(reverse('property-list-create'), data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['verification_status'], 'APPROVED')
        self.assertEqual(response.data['status'], 'ACTIVE')
        new_prop = Property.objects.get(id=response.data['id'])
        self.assertEqual(new_prop.verification_status, 'APPROVED')
        self.assertEqual(new_prop.status, 'ACTIVE')
        self.assertEqual(new_prop.owner, self.admin)

    def test_admin_creation_omitted_status_preserves_safe_defaults(self):
        self.client.force_authenticate(user=self.admin)
        data = {
            'title': 'Admin Default Prop', 'description': 'Desc', 'price': 500, 'area': 100,
            'property_type': 'VILLA', 'listing_type': 'RENT', 'address': '1', 'city': 'c', 'state': 's', 'pincode': '1'
        }
        response = self.client.post(reverse('property-list-create'), data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['verification_status'], 'PENDING')
        self.assertEqual(response.data['status'], 'ACTIVE')
        new_prop = Property.objects.get(id=response.data['id'])
        self.assertEqual(new_prop.verification_status, 'PENDING')
        self.assertEqual(new_prop.status, 'ACTIVE')

    def test_admin_invalid_verification_status_rejected(self):
        self.client.force_authenticate(user=self.admin)
        data = {
            'title': 'Admin Invalid Prop', 'description': 'Desc', 'price': 500, 'area': 100,
            'property_type': 'VILLA', 'listing_type': 'RENT', 'address': '1', 'city': 'c', 'state': 's', 'pincode': '1',
            'verification_status': 'SUPER_APPROVED'
        }
        response = self.client.post(reverse('property-list-create'), data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('verification_status', response.data)

    def test_admin_invalid_status_rejected(self):
        self.client.force_authenticate(user=self.admin)
        data = {
            'title': 'Admin Invalid Status Prop', 'description': 'Desc', 'price': 500, 'area': 100,
            'property_type': 'VILLA', 'listing_type': 'RENT', 'address': '1', 'city': 'c', 'state': 's', 'pincode': '1',
            'status': 'UNKNOWN_STATUS'
        }
        response = self.client.post(reverse('property-list-create'), data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('status', response.data)

    def test_property_owner_is_always_authenticated_user(self):
        self.client.force_authenticate(user=self.user)
        data = {
            'title': 'Impersonation Attempt', 'description': 'Desc', 'price': 500, 'area': 100,
            'property_type': 'VILLA', 'listing_type': 'RENT', 'address': '1', 'city': 'c', 'state': 's', 'pincode': '1',
            'owner': self.admin.id
        }
        response = self.client.post(reverse('property-list-create'), data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        new_prop = Property.objects.get(id=response.data['id'])
        self.assertEqual(new_prop.owner, self.user)
        self.assertNotEqual(new_prop.owner, self.admin)

    def test_public_visibility_admin_created_pending_is_hidden(self):
        self.client.force_authenticate(user=self.admin)
        data_pending = {
            'title': 'Admin Created Pending', 'description': 'Desc', 'price': 500, 'area': 100,
            'property_type': 'VILLA', 'listing_type': 'RENT', 'address': '1', 'city': 'c', 'state': 's', 'pincode': '1',
            'verification_status': 'PENDING'
        }
        res_pending = self.client.post(reverse('property-list-create'), data_pending)
        self.assertEqual(res_pending.status_code, status.HTTP_201_CREATED)
        pending_id = res_pending.data['id']

        # Unauthenticate to test public access
        self.client.force_authenticate(user=None)
        res_public_list = self.client.get(reverse('property-list-create'))
        self.assertEqual(res_public_list.status_code, status.HTTP_200_OK)
        results = res_public_list.data.get('results', res_public_list.data) if isinstance(res_public_list.data, dict) else res_public_list.data
        self.assertFalse(any(p['id'] == pending_id for p in results))

        # Check detail endpoint for public
        res_public_detail = self.client.get(reverse('property-detail', kwargs={'pk': pending_id}))
        self.assertEqual(res_public_detail.status_code, status.HTTP_404_NOT_FOUND)

    def test_non_owner_cannot_edit_property(self):
        self.client.force_authenticate(user=self.user) # user is not admin and not owner
        response = self.client.patch(reverse('property-detail', kwargs={'pk': self.property.id}), {'title': 'Changed'})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_owner_can_edit_property_but_not_verification_status(self):
        owner_user = User.objects.create_user(username='owner2', email='owner2@test.com', password='password', role='USER')
        prop2 = Property.objects.create(
            owner=owner_user, title='Prop', description='Desc', property_type='VILLA',
            listing_type='SALE', price=1, area=1, city='c', state='s', pincode='1',
            status='ACTIVE', verification_status='PENDING'
        )
        self.client.force_authenticate(user=owner_user)
        response = self.client.patch(reverse('property-detail', kwargs={'pk': prop2.id}), {'title': 'Changed', 'verification_status': 'APPROVED'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], 'Changed')
        self.assertEqual(response.data['verification_status'], 'PENDING') # Ignored the attempt to approve



    def test_admin_can_approve_property(self):
        owner_user = User.objects.create_user(username='owner3', email='owner3@test.com', password='password', role='USER')
        prop3 = Property.objects.create(
            owner=owner_user, title='Prop3', description='Desc3', property_type='VILLA',
            listing_type='SALE', price=1, area=1, city='c', state='s', pincode='1',
            status='ACTIVE', verification_status='PENDING'
        )
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(reverse('property-detail', kwargs={'pk': prop3.id}), {'verification_status': 'APPROVED'})
        self.assertEqual(response.status_code, 200)
        
        # Verify persistence
        prop3.refresh_from_db()
        self.assertEqual(prop3.verification_status, 'APPROVED')
        
    def test_admin_can_retrieve_pending_properties(self):
        owner_user = User.objects.create_user(username='owner4', email='owner4@test.com', password='password', role='USER')
        Property.objects.create(
            owner=owner_user, title='Prop4', description='Desc4', property_type='VILLA',
            listing_type='SALE', price=1, area=1, city='c', state='s', pincode='1',
            status='ACTIVE', verification_status='PENDING'
        )
        self.client.force_authenticate(user=self.admin)
        # Verify the endpoint can filter correctly
        response = self.client.get(reverse('property-list-create') + '?verification_status=PENDING')
        self.assertEqual(response.status_code, 200)
        
        # Depending on pagination, data is a list or dict with 'results'
        results = response.data.get('results', response.data) if isinstance(response.data, dict) else response.data
        
        has_pending = any(p['verification_status'] == 'PENDING' for p in results)
        self.assertTrue(has_pending)

    def test_admin_can_edit_property(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(reverse('property-detail', kwargs={'pk': self.property.id}), {'title': 'Changed'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)


    def test_admin_can_reject_property(self):
        owner_user = User.objects.create_user(username='owner5', email='owner5@test.com', password='password', role='USER')
        prop = Property.objects.create(
            owner=owner_user, title='Prop5', description='Desc5', property_type='VILLA',
            listing_type='SALE', price=1, area=1, city='c', state='s', pincode='1',
            status='ACTIVE', verification_status='PENDING'
        )
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(reverse('property-detail', kwargs={'pk': prop.id}), {'verification_status': 'REJECTED'})
        self.assertEqual(response.status_code, 200)
        
        # Verify persistence
        prop.refresh_from_db()
        self.assertEqual(prop.verification_status, 'REJECTED')
        
    def test_user_cannot_approve_property(self):
        owner_user = User.objects.create_user(username='owner6', email='owner6@test.com', password='password', role='USER')
        prop = Property.objects.create(
            owner=owner_user, title='Prop6', description='Desc6', property_type='VILLA',
            listing_type='SALE', price=1, area=1, city='c', state='s', pincode='1',
            status='ACTIVE', verification_status='PENDING'
        )
        self.client.force_authenticate(user=owner_user)
        response = self.client.patch(reverse('property-detail', kwargs={'pk': prop.id}), {'verification_status': 'APPROVED'})
        self.assertEqual(response.status_code, 200)
        
        # Verify it was ignored
        prop.refresh_from_db()
        self.assertEqual(prop.verification_status, 'PENDING')

    def test_agent_cannot_approve_property(self):
        prop = Property.objects.create(
            owner=self.agent, title='AgentProp', description='Desc', property_type='VILLA',
            listing_type='SALE', price=1, area=1, city='c', state='s', pincode='1',
            status='ACTIVE', verification_status='PENDING'
        )
        self.client.force_authenticate(user=self.agent)
        response = self.client.patch(reverse('property-detail', kwargs={'pk': prop.id}), {'verification_status': 'APPROVED'})
        self.assertEqual(response.status_code, 200)
        prop.refresh_from_db()
        self.assertEqual(prop.verification_status, 'PENDING')

    def test_verification_status_values_for_badge_rendering(self):
        prop_pending = Property.objects.create(
            owner=self.user, title='Pending Prop', description='Desc', property_type='VILLA',
            listing_type='SALE', price=1, area=1, city='c', state='s', pincode='1',
            status='ACTIVE', verification_status='PENDING'
        )
        prop_approved = Property.objects.create(
            owner=self.user, title='Approved Prop', description='Desc', property_type='VILLA',
            listing_type='SALE', price=1, area=1, city='c', state='s', pincode='1',
            status='ACTIVE', verification_status='APPROVED'
        )
        prop_rejected = Property.objects.create(
            owner=self.user, title='Rejected Prop', description='Desc', property_type='VILLA',
            listing_type='SALE', price=1, area=1, city='c', state='s', pincode='1',
            status='ACTIVE', verification_status='REJECTED'
        )
        
        self.client.force_authenticate(user=self.user)
        res_pending = self.client.get(reverse('property-detail', kwargs={'pk': prop_pending.id}))
        self.assertEqual(res_pending.data['verification_status'], 'PENDING')
        
        res_approved = self.client.get(reverse('property-detail', kwargs={'pk': prop_approved.id}))
        self.assertEqual(res_approved.data['verification_status'], 'APPROVED')
        
        res_rejected = self.client.get(reverse('property-detail', kwargs={'pk': prop_rejected.id}))
        self.assertEqual(res_rejected.data['verification_status'], 'REJECTED')

    def test_owner_can_delete_property(self):
        owner_user = User.objects.create_user(username='del_owner', email='del_owner@test.com', password='password', role='USER')
        prop = Property.objects.create(
            owner=owner_user, title='Owner Prop', description='Desc', property_type='VILLA',
            listing_type='SALE', price=1000, area=100, city='City', state='State', pincode='123456',
            status='ACTIVE', verification_status='APPROVED'
        )
        self.client.force_authenticate(user=owner_user)
        response = self.client.delete(reverse('property-detail', kwargs={'pk': prop.id}))
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Property.objects.filter(id=prop.id).exists())

    def test_admin_can_delete_property(self):
        owner_user = User.objects.create_user(username='del_owner2', email='del_owner2@test.com', password='password', role='USER')
        prop = Property.objects.create(
            owner=owner_user, title='Owner Prop 2', description='Desc', property_type='VILLA',
            listing_type='SALE', price=1000, area=100, city='City', state='State', pincode='123456',
            status='ACTIVE', verification_status='APPROVED'
        )
        self.client.force_authenticate(user=self.admin)
        response = self.client.delete(reverse('property-detail', kwargs={'pk': prop.id}))
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Property.objects.filter(id=prop.id).exists())

    def test_unauthenticated_user_cannot_delete_property(self):
        self.client.force_authenticate(user=None)
        response = self.client.delete(reverse('property-detail', kwargs={'pk': self.property.id}))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertTrue(Property.objects.filter(id=self.property.id).exists())

    def test_non_owner_user_cannot_delete_property(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.delete(reverse('property-detail', kwargs={'pk': self.property.id}))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Property.objects.filter(id=self.property.id).exists())

    def test_deleting_property_cascades_images(self):
        owner_user = User.objects.create_user(username='del_owner3', email='del_owner3@test.com', password='password', role='USER')
        prop = Property.objects.create(
            owner=owner_user, title='Owner Prop 3', description='Desc', property_type='VILLA',
            listing_type='SALE', price=1000, area=100, city='City', state='State', pincode='123456',
            status='ACTIVE', verification_status='APPROVED'
        )
        img = PropertyImage.objects.create(property=prop, image='test.jpg', is_primary=True)
        self.client.force_authenticate(user=owner_user)
        response = self.client.delete(reverse('property-detail', kwargs={'pk': prop.id}))
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Property.objects.filter(id=prop.id).exists())
        self.assertFalse(PropertyImage.objects.filter(id=img.id).exists())


class PropertySearchTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='search_owner', email='search@test.com', password='password', role='USER')
        
        Property.objects.create(
            owner=self.owner, title='Cheap Apartment', description='A nice flat', property_type='APARTMENT',
            listing_type='SALE', price=50000, area=1000, bedrooms=2, city='Hyderabad', state='TS', pincode='500001',
            status='ACTIVE', verification_status='APPROVED'
        )
        Property.objects.create(
            owner=self.owner, title='Luxury Villa', description='Huge villa', property_type='VILLA',
            listing_type='SALE', price=200000, area=4000, bedrooms=4, city='Hyderabad', state='TS', pincode='500001',
            status='ACTIVE', verification_status='APPROVED'
        )
        Property.objects.create(
            owner=self.owner, title='Hidden Pending House', description='Wait for approval', property_type='HOUSE',
            listing_type='SALE', price=100000, area=2000, bedrooms=3, city='Hyderabad', state='TS', pincode='500001',
            status='ACTIVE', verification_status='PENDING'
        )

    def test_search_by_property_type(self):
        response = self.client.get(reverse('property-list-create') + '?property_type=VILLA')
        self.assertEqual(response.status_code, 200)
        results = response.data.get('results', response.data) if isinstance(response.data, dict) else response.data
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['title'], 'Luxury Villa')

    def test_search_by_price_range(self):
        response = self.client.get(reverse('property-list-create') + '?max_price=100000')
        self.assertEqual(response.status_code, 200)
        results = response.data.get('results', response.data) if isinstance(response.data, dict) else response.data
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['title'], 'Cheap Apartment')

    def test_public_search_hides_pending(self):
        response = self.client.get(reverse('property-list-create'))
        self.assertEqual(response.status_code, 200)
        results = response.data.get('results', response.data) if isinstance(response.data, dict) else response.data
        self.assertEqual(len(results), 2)
        for r in results:
            self.assertNotEqual(r['verification_status'], 'PENDING')


class PropertyContactPhoneTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username='phone_owner', email='phone_owner@test.com', password='password', role='USER'
        )
        self.other_user = User.objects.create_user(
            username='phone_other', email='phone_other@test.com', password='password', role='USER'
        )
        self.admin = User.objects.create_superuser(
            username='phone_admin', email='phone_admin@test.com', password='password', role='ADMIN'
        )
        self.existing_property = Property.objects.create(
            owner=self.owner,
            title='Existing Property Without Phone',
            description='Test Description',
            property_type='APARTMENT',
            listing_type='SALE',
            price=1500000,
            area=1200,
            address='123 Main Road',
            city='Bangalore',
            state='Karnataka',
            pincode='560001',
            status='ACTIVE',
            verification_status='APPROVED'
        )

    def test_create_property_with_valid_contact_phone(self):
        self.client.force_authenticate(user=self.owner)
        valid_formats = [
            '9876543210',
            '+919876543210',
            '+91 98765 43210',
            '+91-98765-43210',
            '09876543210',
            '8123456789',
        ]
        for phone in valid_formats:
            data = {
                'title': f'Property for {phone}',
                'description': 'Description',
                'property_type': 'HOUSE',
                'listing_type': 'SALE',
                'price': 2500000,
                'area': 1500,
                'address': '456 Cross St',
                'city': 'Chennai',
                'state': 'Tamil Nadu',
                'pincode': '600001',
                'contact_phone': phone,
            }
            response = self.client.post(reverse('property-list-create'), data)
            self.assertEqual(response.status_code, status.HTTP_201_CREATED, f"Failed for valid phone: {phone}")
            self.assertEqual(response.data['contact_phone'], phone.strip())
            prop = Property.objects.get(id=response.data['id'])
            self.assertEqual(prop.contact_phone, phone.strip())

    def test_update_property_contact_phone_by_owner(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.patch(
            reverse('property-detail', kwargs={'pk': self.existing_property.id}),
            {'contact_phone': '+91 91234 56789'}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['contact_phone'], '+91 91234 56789')
        self.existing_property.refresh_from_db()
        self.assertEqual(self.existing_property.contact_phone, '+91 91234 56789')

    def test_reject_invalid_contact_phone_formats(self):
        self.client.force_authenticate(user=self.owner)
        invalid_numbers = [
            '12345',               # too short
            '1234567890',          # starts with 1 (not 6, 7, 8, or 9)
            '5555555555',          # starts with 5
            'abcdefghij',          # letters
            '+1-555-123-4567',     # invalid country code (US)
            '9876543210123',       # too long
            '+91 12345 67890',     # Indian code but starts with 1
        ]
        for invalid_phone in invalid_numbers:
            data = {
                'title': 'Test Property',
                'description': 'Description',
                'property_type': 'HOUSE',
                'listing_type': 'SALE',
                'price': 1000000,
                'area': 1000,
                'address': '789 Rd',
                'city': 'Delhi',
                'state': 'Delhi',
                'pincode': '110001',
                'contact_phone': invalid_phone,
            }
            response = self.client.post(reverse('property-list-create'), data)
            self.assertEqual(
                response.status_code,
                status.HTTP_400_BAD_REQUEST,
                f"Invalid phone '{invalid_phone}' was not rejected"
            )
            self.assertIn('contact_phone', response.data)

    def test_preserving_existing_property_without_contact_number(self):
        # 1. Existing property has contact_phone as None
        self.assertIsNone(self.existing_property.contact_phone)

        # 2. Detail API returns it safely with contact_phone as None
        response = self.client.get(reverse('property-detail', kwargs={'pk': self.existing_property.id}))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data['contact_phone'])

        # 3. Owner can update unrelated fields without being forced to provide a contact_phone
        self.client.force_authenticate(user=self.owner)
        patch_response = self.client.patch(
            reverse('property-detail', kwargs={'pk': self.existing_property.id}),
            {'title': 'Updated Title Without Phone'}
        )
        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_response.data['title'], 'Updated Title Without Phone')
        self.assertIsNone(patch_response.data['contact_phone'])

    def test_unauthorized_user_cannot_change_property_contact_phone(self):
        # Other user cannot modify owner's contact phone
        self.client.force_authenticate(user=self.other_user)
        response = self.client.patch(
            reverse('property-detail', kwargs={'pk': self.existing_property.id}),
            {'contact_phone': '9876543210'}
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.existing_property.refresh_from_db()
        self.assertIsNone(self.existing_property.contact_phone)

    def test_admin_can_update_any_property_contact_phone(self):
        # Admin has permission to update contact phone
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(
            reverse('property-detail', kwargs={'pk': self.existing_property.id}),
            {'contact_phone': '+91 99999 88888'}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['contact_phone'], '+91 99999 88888')
        self.existing_property.refresh_from_db()
        self.assertEqual(self.existing_property.contact_phone, '+91 99999 88888')


class ShopPropertyBathroomTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username='shop_owner', email='shop_owner@test.com', password='password', role='USER'
        )
        self.client.force_authenticate(user=self.owner)
        self.base_shop_data = {
            'title': 'Commercial High Street Shop',
            'description': 'Prime location retail shop with glass facade',
            'property_type': 'SHOP',
            'listing_type': 'RENT',
            'price': 45000,
            'area': 650,
            'address': 'Shop 12, MG Road Market',
            'city': 'Bangalore',
            'state': 'Karnataka',
            'pincode': '560001',
            'contact_phone': '9876543210'
        }

    def test_create_shop_with_positive_bathrooms_succeeds(self):
        data = self.base_shop_data.copy()
        data['bathrooms'] = 1
        response = self.client.post(reverse('property-list-create'), data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['bathrooms'], 1)
        prop = Property.objects.get(id=response.data['id'])
        self.assertEqual(prop.bathrooms, 1)

    def test_create_shop_with_zero_bathrooms_succeeds(self):
        data = self.base_shop_data.copy()
        data['bathrooms'] = 0
        response = self.client.post(reverse('property-list-create'), data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['bathrooms'], 0)
        prop = Property.objects.get(id=response.data['id'])
        self.assertEqual(prop.bathrooms, 0)

    def test_create_shop_without_bathrooms_fails(self):
        data = self.base_shop_data.copy()
        # Omit bathrooms field completely
        response = self.client.post(reverse('property-list-create'), data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('bathrooms', response.data)

    def test_create_shop_with_null_bathrooms_fails(self):
        data = self.base_shop_data.copy()
        data['bathrooms'] = None
        response = self.client.post(reverse('property-list-create'), data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('bathrooms', response.data)

    def test_create_shop_with_negative_bathrooms_fails(self):
        data = self.base_shop_data.copy()
        data['bathrooms'] = -1
        response = self.client.post(reverse('property-list-create'), data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('bathrooms', response.data)

    def test_update_shop_bathrooms_to_zero_succeeds(self):
        shop = Property.objects.create(
            owner=self.owner,
            title='Existing Shop',
            description='Existing shop description',
            property_type='SHOP',
            listing_type='RENT',
            price=30000,
            area=500,
            bathrooms=1,
            address='Address',
            city='City',
            state='State',
            pincode='123456'
        )
        response = self.client.patch(
            reverse('property-detail', kwargs={'pk': shop.id}),
            {'bathrooms': 0}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['bathrooms'], 0)
        shop.refresh_from_db()
        self.assertEqual(shop.bathrooms, 0)

    def test_update_shop_bathrooms_to_null_fails(self):
        shop = Property.objects.create(
            owner=self.owner,
            title='Existing Shop 2',
            description='Existing shop description',
            property_type='SHOP',
            listing_type='RENT',
            price=30000,
            area=500,
            bathrooms=1,
            address='Address',
            city='City',
            state='State',
            pincode='123456'
        )
        response = self.client.patch(
            reverse('property-detail', kwargs={'pk': shop.id}),
            {'bathrooms': None},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('bathrooms', response.data)

    def test_non_shop_property_without_bathrooms_remains_valid(self):
        # Office, Warehouse, and Plot do not require bathrooms
        for ptype in ['OFFICE', 'WAREHOUSE', 'PLOT']:
            data = {
                'title': f'Property {ptype}',
                'description': f'Description for {ptype}',
                'property_type': ptype,
                'listing_type': 'RENT',
                'price': 50000,
                'area': 1200,
                'address': 'Road 1',
                'city': 'City',
                'state': 'State',
                'pincode': '123456',
                'contact_phone': '9876543210'
            }
            response = self.client.post(reverse('property-list-create'), data)
            self.assertEqual(
                response.status_code,
                status.HTTP_201_CREATED,
                f"Non-shop type {ptype} failed without bathrooms: {response.data}"
            )
            self.assertIsNone(response.data['bathrooms'])

    def test_compatibility_existing_shop_without_bathrooms_can_be_retrieved(self):
        legacy_shop = Property.objects.create(
            owner=self.owner,
            title='Legacy Shop Without Bathrooms',
            description='Old shop record created before bathrooms requirement',
            property_type='SHOP',
            listing_type='RENT',
            price=25000,
            area=400,
            bathrooms=None,
            address='Old Market',
            city='City',
            state='State',
            pincode='123456',
            status='ACTIVE',
            verification_status='APPROVED'
        )
        response = self.client.get(reverse('property-detail', kwargs={'pk': legacy_shop.id}))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data['bathrooms'])


class MyPropertiesDashboardTests(APITestCase):
    def setUp(self):
        self.owner_a = User.objects.create_user(
            username='owner_a', email='owner_a@test.com', password='password', role='AGENT'
        )
        self.owner_b = User.objects.create_user(
            username='owner_b', email='owner_b@test.com', password='password', role='USER'
        )
        self.admin = User.objects.create_superuser(
            username='my_prop_admin', email='my_prop_admin@test.com', password='password', role='ADMIN'
        )

        # Properties for owner A
        self.prop_a_approved = Property.objects.create(
            owner=self.owner_a, title='Owner A Approved', description='Desc A1', property_type='APARTMENT',
            listing_type='SALE', price=1000000, area=900, city='Hyderabad', state='TS', pincode='500001',
            status='ACTIVE', verification_status='APPROVED'
        )
        self.prop_a_pending = Property.objects.create(
            owner=self.owner_a, title='Owner A Pending', description='Desc A2', property_type='HOUSE',
            listing_type='SALE', price=1500000, area=1200, city='Hyderabad', state='TS', pincode='500001',
            status='ACTIVE', verification_status='PENDING'
        )
        self.prop_a_rejected = Property.objects.create(
            owner=self.owner_a, title='Owner A Rejected', description='Desc A3', property_type='VILLA',
            listing_type='SALE', price=2000000, area=1800, city='Hyderabad', state='TS', pincode='500001',
            status='ACTIVE', verification_status='REJECTED'
        )
        self.prop_a_inactive = Property.objects.create(
            owner=self.owner_a, title='Owner A Inactive', description='Desc A4', property_type='PLOT',
            listing_type='SALE', price=500000, area=2000, city='Hyderabad', state='TS', pincode='500001',
            status='INACTIVE', verification_status='APPROVED'
        )

        # Properties for owner B
        self.prop_b_approved = Property.objects.create(
            owner=self.owner_b, title='Owner B Approved', description='Desc B1', property_type='APARTMENT',
            listing_type='RENT', price=25000, area=800, city='Bangalore', state='KA', pincode='560001',
            status='ACTIVE', verification_status='APPROVED'
        )
        self.prop_b_pending = Property.objects.create(
            owner=self.owner_b, title='Owner B Pending', description='Desc B2', property_type='HOUSE',
            listing_type='RENT', price=35000, area=1100, city='Bangalore', state='KA', pincode='560001',
            status='ACTIVE', verification_status='PENDING'
        )
        self.prop_b_rejected = Property.objects.create(
            owner=self.owner_b, title='Owner B Rejected', description='Desc B3', property_type='OFFICE',
            listing_type='RENT', price=50000, area=1500, city='Bangalore', state='KA', pincode='560001',
            status='ACTIVE', verification_status='REJECTED'
        )

    def test_authenticated_owner_receives_only_their_own_properties(self):
        self.client.force_authenticate(user=self.owner_a)
        response = self.client.get(reverse('property-list-create') + '?my_properties=true')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results', response.data) if isinstance(response.data, dict) else response.data
        
        self.assertEqual(len(results), 4)
        for item in results:
            self.assertEqual(item['owner'], self.owner_a.id)

    def test_owner_sees_all_verification_statuses_approved_pending_rejected(self):
        self.client.force_authenticate(user=self.owner_a)
        response = self.client.get(reverse('property-list-create') + '?my_properties=true')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results', response.data) if isinstance(response.data, dict) else response.data

        returned_statuses = {item['verification_status'] for item in results}
        self.assertIn('APPROVED', returned_statuses)
        self.assertIn('PENDING', returned_statuses)
        self.assertIn('REJECTED', returned_statuses)

        returned_listing_statuses = {item['status'] for item in results}
        self.assertIn('ACTIVE', returned_listing_statuses)
        self.assertIn('INACTIVE', returned_listing_statuses)

    def test_user_cannot_retrieve_another_users_private_listings(self):
        self.client.force_authenticate(user=self.owner_a)
        response = self.client.get(reverse('property-list-create') + '?my_properties=true')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results', response.data) if isinstance(response.data, dict) else response.data

        returned_ids = {item['id'] for item in results}
        self.assertNotIn(self.prop_b_approved.id, returned_ids)
        self.assertNotIn(self.prop_b_pending.id, returned_ids)
        self.assertNotIn(self.prop_b_rejected.id, returned_ids)

    def test_supplying_another_owner_id_does_not_bypass_ownership_filtering(self):
        self.client.force_authenticate(user=self.owner_a)
        # Attempt to impersonate or query owner_b via query params
        url = reverse('property-list-create') + f'?my_properties=true&owner={self.owner_b.id}&owner_id={self.owner_b.id}&owner_email={self.owner_b.email}'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results', response.data) if isinstance(response.data, dict) else response.data

        self.assertEqual(len(results), 4)
        for item in results:
            self.assertEqual(item['owner'], self.owner_a.id)
            self.assertNotEqual(item['owner'], self.owner_b.id)

    def test_anonymous_requests_cannot_access_my_properties(self):
        # Unauthenticated client
        self.client.force_authenticate(user=None)
        response = self.client.get(reverse('property-list-create') + '?my_properties=true')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_existing_public_listing_behavior_remains_unchanged(self):
        self.client.force_authenticate(user=None)
        response = self.client.get(reverse('property-list-create'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results', response.data) if isinstance(response.data, dict) else response.data

        # Only ACTIVE and APPROVED properties are visible to the public
        for item in results:
            self.assertEqual(item['status'], 'ACTIVE')
            self.assertEqual(item['verification_status'], 'APPROVED')

        returned_ids = {item['id'] for item in results}
        self.assertIn(self.prop_a_approved.id, returned_ids)
        self.assertIn(self.prop_b_approved.id, returned_ids)
        self.assertNotIn(self.prop_a_pending.id, returned_ids)
        self.assertNotIn(self.prop_a_rejected.id, returned_ids)
        self.assertNotIn(self.prop_a_inactive.id, returned_ids)
        self.assertNotIn(self.prop_b_pending.id, returned_ids)
        self.assertNotIn(self.prop_b_rejected.id, returned_ids)

    def test_admin_behavior_with_and_without_my_properties(self):
        self.client.force_authenticate(user=self.admin)
        # Without my_properties, admin sees all listings
        response_all = self.client.get(reverse('property-list-create'))
        self.assertEqual(response_all.status_code, status.HTTP_200_OK)
        results_all = response_all.data.get('results', response_all.data) if isinstance(response_all.data, dict) else response_all.data
        self.assertGreaterEqual(len(results_all), 7)

        # With my_properties, admin sees only their own listings
        response_my = self.client.get(reverse('property-list-create') + '?my_properties=true')
        self.assertEqual(response_my.status_code, status.HTTP_200_OK)
        results_my = response_my.data.get('results', response_my.data) if isinstance(response_my.data, dict) else response_my.data
        self.assertEqual(len(results_my), 0)

        # Create one property owned by admin
        admin_prop = Property.objects.create(
            owner=self.admin, title='Admin Prop', description='Desc Admin', property_type='OFFICE',
            listing_type='SALE', price=5000000, area=3000, city='Delhi', state='DL', pincode='110001',
            status='ACTIVE', verification_status='APPROVED'
        )
        response_my_after = self.client.get(reverse('property-list-create') + '?my_properties=true')
        self.assertEqual(response_my_after.status_code, status.HTTP_200_OK)
        results_my_after = response_my_after.data.get('results', response_my_after.data) if isinstance(response_my_after.data, dict) else response_my_after.data
        self.assertEqual(len(results_my_after), 1)
        self.assertEqual(results_my_after[0]['id'], admin_prop.id)


@override_settings(SMS_PROVIDER='accounts.sms.MockSMSProvider')
class AutoPublicationAndPhoneVerificationTests(APITestCase):
    def setUp(self):
        self.user_a = User.objects.create_user(
            username='user_a',
            email='user_a@example.com',
            password='Password123!',
            role='USER'
        )
        self.user_b = User.objects.create_user(
            username='user_b',
            email='user_b@example.com',
            password='Password123!',
            role='USER'
        )
        self.admin = User.objects.create_user(
            username='admin_user',
            email='admin@example.com',
            password='Password123!',
            role='ADMIN',
            is_staff=True
        )
        self.phone_a = '+919876543210'
        self.phone_b = '+919876543211'
        self.prop_list_url = reverse('property-list-create')
        self.verify_otp_url = reverse('auth_otp_verify')

    def _sample_property_data(self, **kwargs):
        data = {
            'title': 'Sample Property',
            'description': 'A nice place to live',
            'property_type': 'APARTMENT',
            'listing_type': 'SALE',
            'price': '3500000.00',
            'area': '1200.00',
            'bedrooms': 2,
            'bathrooms': 2,
            'city': 'Mumbai',
            'state': 'Maharashtra',
            'address': '123 Marine Drive',
            'pincode': '400020',
            'contact_phone': '9876543210',
        }
        data.update(kwargs)
        return data

    def test_user_with_verified_matching_phone_creates_automatically_approved_active_property(self):
        # 1. User with verified matching phone creates automatically approved ACTIVE property
        pv = PhoneVerification.create_challenge(
            phone=self.phone_a,
            raw_otp='123456',
            user=self.user_a
        )
        pv.mark_verified()

        self.client.force_authenticate(user=self.user_a)
        data = self._sample_property_data(contact_phone='9876543210')
        response = self.client.post(self.prop_list_url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        prop_id = response.data['id']
        prop = Property.objects.get(id=prop_id)
        self.assertEqual(prop.owner, self.user_a)
        self.assertEqual(prop.status, 'ACTIVE')
        self.assertEqual(prop.verification_status, 'APPROVED')

    def test_unverified_phone_cannot_trigger_automatic_publication(self):
        # 2. Property creation publishes automatically without requiring phone verification
        self.client.force_authenticate(user=self.user_a)
        data = self._sample_property_data(contact_phone='9876543210')
        response = self.client.post(self.prop_list_url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        prop_id = response.data['id']
        prop = Property.objects.get(id=prop_id)
        self.assertEqual(prop.owner, self.user_a)
        self.assertEqual(prop.status, 'ACTIVE')
        self.assertEqual(prop.verification_status, 'APPROVED')

    def test_verified_phone_belonging_to_another_user_cannot_authorize_publication(self):
        # 3. Property creation publishes automatically without requiring user phone verification
        pv_b = PhoneVerification.create_challenge(
            phone=self.phone_a,
            raw_otp='123456',
            user=self.user_b
        )
        pv_b.mark_verified()

        self.client.force_authenticate(user=self.user_a)
        data = self._sample_property_data(contact_phone='+91 9876543210')
        response = self.client.post(self.prop_list_url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        prop_id = response.data['id']
        prop = Property.objects.get(id=prop_id)
        self.assertEqual(prop.owner, self.user_a)
        self.assertEqual(prop.verification_status, 'APPROVED')

    def test_verified_but_different_phone_cannot_authorize_publication(self):
        # 4. Property creation publishes automatically without requiring matching verified phone
        pv_a = PhoneVerification.create_challenge(
            phone=self.phone_a,
            raw_otp='123456',
            user=self.user_a
        )
        pv_a.mark_verified()

        self.client.force_authenticate(user=self.user_a)
        # Post property with phone_b (+919876543211)
        data = self._sample_property_data(contact_phone='9876543211')
        response = self.client.post(self.prop_list_url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        prop_id = response.data['id']
        prop = Property.objects.get(id=prop_id)
        self.assertEqual(prop.verification_status, 'APPROVED')

    def test_client_supplied_verification_status_cannot_bypass_verification(self):
        # 5. Client-supplied verification_status='APPROVED' on PATCH cannot bypass verification for pending properties
        prop = Property.objects.create(
            owner=self.user_a,
            title='Pending Property',
            description='Desc',
            property_type='APARTMENT',
            listing_type='SALE',
            price=2000000,
            area=900,
            city='Mumbai',
            state='MH',
            pincode='400001',
            contact_phone='9876543210',
            status='ACTIVE',
            verification_status='PENDING'
        )
        self.client.force_authenticate(user=self.user_a)
        detail_url = reverse('property-detail', kwargs={'pk': prop.id})
        patch_res = self.client.patch(detail_url, {'verification_status': 'APPROVED'})
        self.assertEqual(patch_res.status_code, status.HTTP_200_OK)
        prop.refresh_from_db()
        self.assertEqual(prop.verification_status, 'PENDING')

    def test_client_supplied_owner_ids_cannot_change_ownership(self):
        # 6. Client-supplied owner IDs cannot change ownership
        self.client.force_authenticate(user=self.user_a)
        data = self._sample_property_data(owner=self.user_b.id, owner_id=self.user_b.id)
        response = self.client.post(self.prop_list_url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        prop_id = response.data['id']
        prop = Property.objects.get(id=prop_id)
        self.assertEqual(prop.owner, self.user_a)

        # Attempt PATCH owner
        detail_url = reverse('property-detail', kwargs={'pk': prop.id})
        patch_res = self.client.patch(detail_url, {'owner': self.user_b.id})
        self.assertEqual(patch_res.status_code, status.HTTP_200_OK)
        prop.refresh_from_db()
        self.assertEqual(prop.owner, self.user_a)

    def test_successful_verification_promotes_only_same_users_eligible_pending_properties(self):
        # 7. Successful verification promotes only the same user's eligible pending properties
        prop1 = Property.objects.create(
            owner=self.user_a,
            title='User A Pending Matching',
            description='Desc 1',
            property_type='APARTMENT',
            listing_type='SALE',
            price=2000000,
            area=900,
            city='Mumbai',
            state='MH',
            pincode='400001',
            contact_phone='9876543210',
            status='ACTIVE',
            verification_status='PENDING'
        )
        prop2 = Property.objects.create(
            owner=self.user_a,
            title='User A Pending Non-matching Phone',
            description='Desc 2',
            property_type='APARTMENT',
            listing_type='SALE',
            price=2500000,
            area=1000,
            city='Mumbai',
            state='MH',
            pincode='400001',
            contact_phone='9876543211',
            status='ACTIVE',
            verification_status='PENDING'
        )

        # User A requests and verifies OTP for +919876543210
        self.client.force_authenticate(user=self.user_a)
        pv = PhoneVerification.create_challenge(
            phone=self.phone_a,
            raw_otp='778899',
            user=self.user_a
        )

        res = self.client.post(self.verify_otp_url, {
            'phone': '9876543210',
            'otp': '778899'
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        prop1.refresh_from_db()
        prop2.refresh_from_db()
        self.assertEqual(prop1.verification_status, 'APPROVED')
        self.assertEqual(prop2.verification_status, 'PENDING')

    def test_properties_belonging_to_other_users_remain_unchanged(self):
        # 8. Properties belonging to other users remain unchanged
        prop_b = Property.objects.create(
            owner=self.user_b,
            title='User B Pending',
            description='Desc B',
            property_type='APARTMENT',
            listing_type='SALE',
            price=3000000,
            area=1100,
            city='Pune',
            state='MH',
            pincode='411001',
            contact_phone='9876543210',
            status='ACTIVE',
            verification_status='PENDING'
        )

        # User A verifies phone
        self.client.force_authenticate(user=self.user_a)
        pv = PhoneVerification.create_challenge(
            phone=self.phone_a,
            raw_otp='112233',
            user=self.user_a
        )
        res = self.client.post(self.verify_otp_url, {
            'phone': '9876543210',
            'otp': '112233'
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        prop_b.refresh_from_db()
        self.assertEqual(prop_b.verification_status, 'PENDING')

    def test_rejected_properties_remain_rejected(self):
        # 9. REJECTED properties remain rejected
        prop_rejected = Property.objects.create(
            owner=self.user_a,
            title='User A Rejected',
            description='Desc R',
            property_type='HOUSE',
            listing_type='SALE',
            price=4000000,
            area=1500,
            city='Mumbai',
            state='MH',
            pincode='400001',
            contact_phone='9876543210',
            status='ACTIVE',
            verification_status='REJECTED'
        )

        self.client.force_authenticate(user=self.user_a)
        pv = PhoneVerification.create_challenge(
            phone=self.phone_a,
            raw_otp='334455',
            user=self.user_a
        )
        res = self.client.post(self.verify_otp_url, {
            'phone': '9876543210',
            'otp': '334455'
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        prop_rejected.refresh_from_db()
        self.assertEqual(prop_rejected.verification_status, 'REJECTED')

    def test_inactive_properties_remain_inactive(self):
        # 10. INACTIVE properties remain inactive
        prop_inactive = Property.objects.create(
            owner=self.user_a,
            title='User A Inactive',
            description='Desc I',
            property_type='PLOT',
            listing_type='SALE',
            price=1000000,
            area=2500,
            city='Mumbai',
            state='MH',
            pincode='400001',
            contact_phone='9876543210',
            status='INACTIVE',
            verification_status='PENDING'
        )

        self.client.force_authenticate(user=self.user_a)
        pv = PhoneVerification.create_challenge(
            phone=self.phone_a,
            raw_otp='445566',
            user=self.user_a
        )
        res = self.client.post(self.verify_otp_url, {
            'phone': '9876543210',
            'otp': '445566'
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        prop_inactive.refresh_from_db()
        self.assertEqual(prop_inactive.status, 'INACTIVE')
        self.assertEqual(prop_inactive.verification_status, 'PENDING')

    def test_sold_and_rented_properties_are_not_accidentally_reactivated(self):
        # 11. SOLD and RENTED properties are not accidentally reactivated or promoted
        prop_sold = Property.objects.create(
            owner=self.user_a,
            title='User A Sold',
            description='Desc S',
            property_type='APARTMENT',
            listing_type='SALE',
            price=5000000,
            area=1200,
            city='Mumbai',
            state='MH',
            pincode='400001',
            contact_phone='9876543210',
            status='SOLD',
            verification_status='PENDING'
        )
        prop_rented = Property.objects.create(
            owner=self.user_a,
            title='User A Rented',
            description='Desc Rent',
            property_type='APARTMENT',
            listing_type='RENT',
            price=30000,
            area=800,
            city='Mumbai',
            state='MH',
            pincode='400001',
            contact_phone='9876543210',
            status='RENTED',
            verification_status='PENDING'
        )

        self.client.force_authenticate(user=self.user_a)
        pv = PhoneVerification.create_challenge(
            phone=self.phone_a,
            raw_otp='556677',
            user=self.user_a
        )
        res = self.client.post(self.verify_otp_url, {
            'phone': '9876543210',
            'otp': '556677'
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        prop_sold.refresh_from_db()
        prop_rented.refresh_from_db()
        self.assertEqual(prop_sold.status, 'SOLD')
        self.assertEqual(prop_sold.verification_status, 'PENDING')
        self.assertEqual(prop_rented.status, 'RENTED')
        self.assertEqual(prop_rented.verification_status, 'PENDING')

    def test_admin_moderation_still_works(self):
        # 12. Admin moderation still works
        prop = Property.objects.create(
            owner=self.user_a,
            title='Moderation Target',
            description='Target for admin moderation',
            property_type='APARTMENT',
            listing_type='SALE',
            price=3000000,
            area=1000,
            city='Mumbai',
            state='MH',
            pincode='400001',
            contact_phone='9876543210',
            status='ACTIVE',
            verification_status='APPROVED'
        )

        detail_url = reverse('property-detail', kwargs={'pk': prop.id})
        self.client.force_authenticate(user=self.admin)

        # Admin rejects property
        patch1 = self.client.patch(detail_url, {'verification_status': 'REJECTED'})
        self.assertEqual(patch1.status_code, status.HTTP_200_OK)
        prop.refresh_from_db()
        self.assertEqual(prop.verification_status, 'REJECTED')

        # Admin deactivates property
        patch2 = self.client.patch(detail_url, {'status': 'INACTIVE'})
        self.assertEqual(patch2.status_code, status.HTTP_200_OK)
        prop.refresh_from_db()
        self.assertEqual(prop.status, 'INACTIVE')

        # Admin re-approves and activates property
        patch3 = self.client.patch(detail_url, {'verification_status': 'APPROVED', 'status': 'ACTIVE'})
        self.assertEqual(patch3.status_code, status.HTTP_200_OK)
        prop.refresh_from_db()
        self.assertEqual(prop.verification_status, 'APPROVED')
        self.assertEqual(prop.status, 'ACTIVE')

    def test_public_listing_and_detail_endpoints_hide_pending_rejected_and_inactive_properties(self):
        # 13. Public listing and detail endpoints hide pending, rejected, and inactive properties
        p_active_approved = Property.objects.create(
            owner=self.user_a,
            title='Pub Approved Active',
            description='Desc 1',
            property_type='APARTMENT',
            listing_type='SALE',
            price=2000000,
            area=900,
            city='Mumbai',
            state='MH',
            pincode='400001',
            status='ACTIVE',
            verification_status='APPROVED'
        )
        p_active_pending = Property.objects.create(
            owner=self.user_a,
            title='Pub Pending Active',
            description='Desc 2',
            property_type='APARTMENT',
            listing_type='SALE',
            price=2000000,
            area=900,
            city='Mumbai',
            state='MH',
            pincode='400001',
            status='ACTIVE',
            verification_status='PENDING'
        )
        p_active_rejected = Property.objects.create(
            owner=self.user_a,
            title='Pub Rejected Active',
            description='Desc 3',
            property_type='APARTMENT',
            listing_type='SALE',
            price=2000000,
            area=900,
            city='Mumbai',
            state='MH',
            pincode='400001',
            status='ACTIVE',
            verification_status='REJECTED'
        )
        p_inactive_approved = Property.objects.create(
            owner=self.user_a,
            title='Pub Approved Inactive',
            description='Desc 4',
            property_type='APARTMENT',
            listing_type='SALE',
            price=2000000,
            area=900,
            city='Mumbai',
            state='MH',
            pincode='400001',
            status='INACTIVE',
            verification_status='APPROVED'
        )

        # Unauthenticated public client
        self.client.force_authenticate(user=None)

        # List endpoint
        list_res = self.client.get(self.prop_list_url)
        self.assertEqual(list_res.status_code, status.HTTP_200_OK)
        results = list_res.data.get('results', list_res.data) if isinstance(list_res.data, dict) else list_res.data
        returned_ids = {item['id'] for item in results}

        self.assertIn(p_active_approved.id, returned_ids)
        self.assertNotIn(p_active_pending.id, returned_ids)
        self.assertNotIn(p_active_rejected.id, returned_ids)
        self.assertNotIn(p_inactive_approved.id, returned_ids)

        # Detail endpoints
        detail_approved = self.client.get(reverse('property-detail', kwargs={'pk': p_active_approved.id}))
        self.assertEqual(detail_approved.status_code, status.HTTP_200_OK)

        detail_pending = self.client.get(reverse('property-detail', kwargs={'pk': p_active_pending.id}))
        self.assertEqual(detail_pending.status_code, status.HTTP_404_NOT_FOUND)

        detail_rejected = self.client.get(reverse('property-detail', kwargs={'pk': p_active_rejected.id}))
        self.assertEqual(detail_rejected.status_code, status.HTTP_404_NOT_FOUND)

        detail_inactive = self.client.get(reverse('property-detail', kwargs={'pk': p_inactive_approved.id}))
        self.assertEqual(detail_inactive.status_code, status.HTTP_404_NOT_FOUND)

    def test_existing_my_properties_behavior_remains_intact(self):
        # 14. Existing My Properties behavior remains intact
        prop_a = Property.objects.create(
            owner=self.user_a,
            title='User A Prop',
            description='Desc A',
            property_type='APARTMENT',
            listing_type='SALE',
            price=1500000,
            area=800,
            city='Delhi',
            state='DL',
            pincode='110001',
            status='ACTIVE',
            verification_status='PENDING'
        )
        prop_b = Property.objects.create(
            owner=self.user_b,
            title='User B Prop',
            description='Desc B',
            property_type='APARTMENT',
            listing_type='SALE',
            price=1800000,
            area=850,
            city='Delhi',
            state='DL',
            pincode='110001',
            status='ACTIVE',
            verification_status='APPROVED'
        )

        self.client.force_authenticate(user=self.user_a)
        response = self.client.get(self.prop_list_url + '?my_properties=true')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results', response.data) if isinstance(response.data, dict) else response.data

        returned_ids = {item['id'] for item in results}
        self.assertIn(prop_a.id, returned_ids)
        self.assertNotIn(prop_b.id, returned_ids)

        # Unauthenticated request
        self.client.force_authenticate(user=None)
        anon_response = self.client.get(self.prop_list_url + '?my_properties=true')
        self.assertEqual(anon_response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_anonymous_verification_does_not_authorize_property_publication(self):
        # 15. Anonymous verification does not authorize or promote properties
        prop = Property.objects.create(
            owner=self.user_a,
            title='User A Pending',
            description='Desc',
            property_type='APARTMENT',
            listing_type='SALE',
            price=2000000,
            area=900,
            city='Mumbai',
            state='MH',
            pincode='400001',
            contact_phone='9876543210',
            status='ACTIVE',
            verification_status='PENDING'
        )

        # Anonymous OTP verification
        self.client.force_authenticate(user=None)
        pv = PhoneVerification.create_challenge(
            phone=self.phone_a,
            raw_otp='998877',
            user=None
        )
        verify_res = self.client.post(self.verify_otp_url, {
            'phone': '9876543210',
            'otp': '998877'
        })
        self.assertEqual(verify_res.status_code, status.HTTP_200_OK)

        # Property of User A must NOT be promoted
        prop.refresh_from_db()
        self.assertEqual(prop.verification_status, 'PENDING')

        # User A creates property and it is published automatically without requiring OTP
        self.client.force_authenticate(user=self.user_a)
        data = self._sample_property_data(contact_phone='9876543210')
        post_res = self.client.post(self.prop_list_url, data)
        self.assertEqual(post_res.status_code, status.HTTP_201_CREATED)
        new_prop = Property.objects.get(id=post_res.data['id'])
        self.assertEqual(new_prop.verification_status, 'APPROVED')

    def test_owner_changes_approved_property_phone_to_unverified_number_demotes_to_pending(self):
        # 16. Owner changes an APPROVED property's phone without requiring OTP and remains APPROVED
        prop = Property.objects.create(
            owner=self.user_a,
            title='Approved Property',
            description='Desc',
            property_type='APARTMENT',
            listing_type='SALE',
            price=2000000,
            area=900,
            city='Mumbai',
            state='MH',
            pincode='400001',
            contact_phone=self.phone_a,
            status='ACTIVE',
            verification_status='APPROVED'
        )

        detail_url = reverse('property-detail', kwargs={'pk': prop.id})
        self.client.force_authenticate(user=self.user_a)

        # Update contact phone to phone_b without OTP
        res = self.client.patch(detail_url, {'contact_phone': '9876543211'})
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        prop.refresh_from_db()
        self.assertEqual(prop.contact_phone, '9876543211')
        self.assertEqual(prop.verification_status, 'APPROVED')

        # Public listing continues to show this property
        self.client.force_authenticate(user=None)
        pub_res = self.client.get(self.prop_list_url)
        results = pub_res.data.get('results', pub_res.data) if isinstance(pub_res.data, dict) else pub_res.data
        pub_ids = [item['id'] for item in results]
        self.assertIn(prop.id, pub_ids)

    def test_owner_changes_phone_to_different_formatting_preserves_approved_status(self):
        # 17. Owner changes the phone to another formatting of the same normalized number
        pv_a = PhoneVerification.create_challenge(phone=self.phone_a, raw_otp='123456', user=self.user_a)
        pv_a.mark_verified()

        prop = Property.objects.create(
            owner=self.user_a,
            title='Approved Property',
            description='Desc',
            property_type='APARTMENT',
            listing_type='SALE',
            price=2000000,
            area=900,
            city='Mumbai',
            state='MH',
            pincode='400001',
            contact_phone=self.phone_a,
            status='ACTIVE',
            verification_status='APPROVED'
        )

        detail_url = reverse('property-detail', kwargs={'pk': prop.id})
        self.client.force_authenticate(user=self.user_a)

        # Update to another formatting of same phone (+91 98765 43210 -> '9876543210')
        res = self.client.patch(detail_url, {'contact_phone': '9876543210'})
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        prop.refresh_from_db()
        self.assertEqual(prop.contact_phone, '9876543210')
        self.assertEqual(prop.verification_status, 'APPROVED')

    def test_owner_changes_phone_to_different_verified_number_preserves_approved_status(self):
        # 18. Owner changes the phone to a different number that has been verified for that same owner
        pv_a = PhoneVerification.create_challenge(phone=self.phone_a, raw_otp='123456', user=self.user_a)
        pv_a.mark_verified()
        pv_b = PhoneVerification.create_challenge(phone=self.phone_b, raw_otp='654321', user=self.user_a)
        pv_b.mark_verified()

        prop = Property.objects.create(
            owner=self.user_a,
            title='Approved Property',
            description='Desc',
            property_type='APARTMENT',
            listing_type='SALE',
            price=2000000,
            area=900,
            city='Mumbai',
            state='MH',
            pincode='400001',
            contact_phone=self.phone_a,
            status='ACTIVE',
            verification_status='APPROVED'
        )

        detail_url = reverse('property-detail', kwargs={'pk': prop.id})
        self.client.force_authenticate(user=self.user_a)

        # Update to phone_b (which is also verified for user_a)
        res = self.client.patch(detail_url, {'contact_phone': '9876543211'})
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        prop.refresh_from_db()
        self.assertEqual(prop.contact_phone, '9876543211')
        self.assertEqual(prop.verification_status, 'APPROVED')

    def test_different_user_verified_number_cannot_authorize_update(self):
        # 19. Phone update does not require OTP and preserves approved status
        prop = Property.objects.create(
            owner=self.user_a,
            title='User A Approved Property',
            description='Desc',
            property_type='APARTMENT',
            listing_type='SALE',
            price=2000000,
            area=900,
            city='Mumbai',
            state='MH',
            pincode='400001',
            contact_phone=self.phone_a,
            status='ACTIVE',
            verification_status='APPROVED'
        )

        detail_url = reverse('property-detail', kwargs={'pk': prop.id})
        self.client.force_authenticate(user=self.user_a)

        # User A updates contact phone
        res = self.client.patch(detail_url, {'contact_phone': '9876543211'})
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        prop.refresh_from_db()
        self.assertEqual(prop.contact_phone, '9876543211')
        self.assertEqual(prop.verification_status, 'APPROVED')

    def test_client_supplied_verification_status_cannot_bypass_phone_change_demotion(self):
        # 20. Client-supplied verification_status cannot promote a PENDING property on update
        prop = Property.objects.create(
            owner=self.user_a,
            title='User A Pending Property',
            description='Desc',
            property_type='APARTMENT',
            listing_type='SALE',
            price=2000000,
            area=900,
            city='Mumbai',
            state='MH',
            pincode='400001',
            contact_phone=self.phone_a,
            status='ACTIVE',
            verification_status='PENDING'
        )

        detail_url = reverse('property-detail', kwargs={'pk': prop.id})
        self.client.force_authenticate(user=self.user_a)

        # Client attempts to update phone and force verification_status='APPROVED'
        res = self.client.patch(detail_url, {
            'contact_phone': '9876543211',
            'verification_status': 'APPROVED',
            'status': 'ACTIVE'
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        prop.refresh_from_db()
        self.assertEqual(prop.contact_phone, '9876543211')
        self.assertEqual(prop.verification_status, 'PENDING')

    def test_admin_moderation_remains_functional_on_phone_update(self):
        # 21. ADMIN moderation remains functional
        prop = Property.objects.create(
            owner=self.user_a,
            title='Moderated Property',
            description='Desc',
            property_type='APARTMENT',
            listing_type='SALE',
            price=2000000,
            area=900,
            city='Mumbai',
            state='MH',
            pincode='400001',
            contact_phone=self.phone_a,
            status='ACTIVE',
            verification_status='APPROVED'
        )

        detail_url = reverse('property-detail', kwargs={'pk': prop.id})
        self.client.force_authenticate(user=self.admin)

        # Admin updates phone - admin moderation is not demoted
        res = self.client.patch(detail_url, {'contact_phone': '9876543211'})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        prop.refresh_from_db()
        self.assertEqual(prop.contact_phone, '9876543211')
        self.assertEqual(prop.verification_status, 'APPROVED')

        # Admin explicitly rejects property
        res2 = self.client.patch(detail_url, {'verification_status': 'REJECTED'})
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        prop.refresh_from_db()
        self.assertEqual(prop.verification_status, 'REJECTED')

        # Owner cannot re-approve rejected property by setting a verified phone
        pv_a = PhoneVerification.create_challenge(phone=self.phone_a, raw_otp='123456', user=self.user_a)
        pv_a.mark_verified()

        self.client.force_authenticate(user=self.user_a)
        res3 = self.client.patch(detail_url, {'contact_phone': '9876543210'})
        self.assertEqual(res3.status_code, status.HTTP_200_OK)
        prop.refresh_from_db()
        self.assertEqual(prop.verification_status, 'REJECTED')

    def test_owner_updates_unrelated_field_preserves_approved_status(self):
        # 22. Unrelated field update does not reset verification status
        prop = Property.objects.create(
            owner=self.user_a,
            title='Initial Title',
            description='Initial Description',
            property_type='APARTMENT',
            listing_type='SALE',
            price=2000000,
            area=900,
            city='Mumbai',
            state='MH',
            pincode='400001',
            contact_phone=self.phone_a,
            status='ACTIVE',
            verification_status='APPROVED'
        )

        detail_url = reverse('property-detail', kwargs={'pk': prop.id})
        self.client.force_authenticate(user=self.user_a)

        res = self.client.patch(detail_url, {'title': 'Updated Title Only', 'price': '2200000.00'})
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        prop.refresh_from_db()
        self.assertEqual(prop.title, 'Updated Title Only')
        self.assertEqual(prop.verification_status, 'APPROVED')


class PropertyPaginationTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username='pag_owner', email='pag_owner@example.com', password='password123', role='USER'
        )
        self.other_user = User.objects.create_user(
            username='other_user', email='other_user@example.com', password='password123', role='USER'
        )
        self.admin = User.objects.create_superuser(
            username='pag_admin', email='pag_admin@example.com', password='password123', role='ADMIN'
        )
        self.list_url = reverse('property-list-create')

        # Create 25 active and approved properties
        self.approved_props = []
        for i in range(25):
            prop = Property.objects.create(
                owner=self.owner,
                title=f'Villa {i:02d}',
                description=f'Beautiful Villa number {i:02d}',
                property_type='VILLA' if i % 2 == 0 else 'APARTMENT',
                listing_type='SALE',
                price=100000 + i * 1000,
                area=1000 + i * 10,
                city='Pune' if i % 2 == 0 else 'Mumbai',
                state='MH',
                pincode='411001',
                status='ACTIVE',
                verification_status='APPROVED'
            )
            self.approved_props.append(prop)

        # Create 2 pending, 1 rejected, and 1 inactive property
        self.pending_prop = Property.objects.create(
            owner=self.owner,
            title='Pending Property',
            description='Pending review',
            property_type='HOUSE',
            listing_type='RENT',
            price=25000,
            area=800,
            city='Pune',
            state='MH',
            pincode='411001',
            status='ACTIVE',
            verification_status='PENDING'
        )
        self.rejected_prop = Property.objects.create(
            owner=self.owner,
            title='Rejected Property',
            description='Rejected listing',
            property_type='HOUSE',
            listing_type='SALE',
            price=30000,
            area=900,
            city='Pune',
            state='MH',
            pincode='411001',
            status='ACTIVE',
            verification_status='REJECTED'
        )
        self.inactive_prop = Property.objects.create(
            owner=self.owner,
            title='Inactive Property',
            description='Inactive listing',
            property_type='HOUSE',
            listing_type='SALE',
            price=35000,
            area=950,
            city='Pune',
            state='MH',
            pincode='411001',
            status='INACTIVE',
            verification_status='APPROVED'
        )

    def test_public_listing_returns_default_page_size_and_pagination_fields(self):
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('count', response.data)
        self.assertIn('next', response.data)
        self.assertIn('previous', response.data)
        self.assertIn('results', response.data)
        self.assertEqual(response.data['count'], 25)
        self.assertEqual(len(response.data['results']), 12)
        self.assertIsNotNone(response.data['next'])
        self.assertIsNone(response.data['previous'])

    def test_requesting_next_page_returns_different_records(self):
        res_page1 = self.client.get(self.list_url)
        self.assertEqual(res_page1.status_code, status.HTTP_200_OK)
        ids_page1 = [p['id'] for p in res_page1.data['results']]

        res_page2 = self.client.get(self.list_url, {'page': 2})
        self.assertEqual(res_page2.status_code, status.HTTP_200_OK)
        ids_page2 = [p['id'] for p in res_page2.data['results']]
        self.assertEqual(len(ids_page2), 12)
        self.assertIsNotNone(res_page2.data['previous'])
        self.assertIsNotNone(res_page2.data['next'])

        # Disjoint ID sets
        self.assertEqual(set(ids_page1).intersection(set(ids_page2)), set())

        # Page 3 has the remaining 1 property
        res_page3 = self.client.get(self.list_url, {'page': 3})
        self.assertEqual(res_page3.status_code, status.HTTP_200_OK)
        ids_page3 = [p['id'] for p in res_page3.data['results']]
        self.assertEqual(len(ids_page3), 1)
        self.assertIsNone(res_page3.data['next'])

    def test_custom_page_size_and_max_page_size_capping(self):
        res_custom = self.client.get(self.list_url, {'page_size': 5})
        self.assertEqual(res_custom.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_custom.data['results']), 5)

        res_capped = self.client.get(self.list_url, {'page_size': 100})
        self.assertEqual(res_capped.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_capped.data['results']), 25)

    def test_invalid_page_and_page_size_handling(self):
        res_out_of_bounds = self.client.get(self.list_url, {'page': 9999})
        self.assertEqual(res_out_of_bounds.status_code, status.HTTP_404_NOT_FOUND)

        res_bad_page = self.client.get(self.list_url, {'page': 'invalid'})
        self.assertEqual(res_bad_page.status_code, status.HTTP_404_NOT_FOUND)

        res_bad_size = self.client.get(self.list_url, {'page_size': 'invalid'})
        self.assertEqual(res_bad_size.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_bad_size.data['results']), 12)

        res_neg_size = self.client.get(self.list_url, {'page_size': -5})
        self.assertEqual(res_neg_size.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_neg_size.data['results']), 12)

    def test_search_and_filters_continue_working_with_pagination(self):
        res_filter = self.client.get(self.list_url, {'city': 'Pune'})
        self.assertEqual(res_filter.status_code, status.HTTP_200_OK)
        self.assertEqual(res_filter.data['count'], 13)
        self.assertEqual(len(res_filter.data['results']), 12)

        res_apt = self.client.get(self.list_url, {'property_type': 'APARTMENT'})
        self.assertEqual(res_apt.status_code, status.HTTP_200_OK)
        self.assertEqual(res_apt.data['count'], 12)
        self.assertEqual(len(res_apt.data['results']), 12)

        res_search = self.client.get(self.list_url, {'search': 'Villa 05'})
        self.assertEqual(res_search.status_code, status.HTTP_200_OK)
        self.assertEqual(res_search.data['count'], 1)
        self.assertEqual(res_search.data['results'][0]['title'], 'Villa 05')

    def test_public_results_do_not_include_pending_rejected_or_inactive(self):
        res = self.client.get(self.list_url, {'page_size': 50})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        returned_ids = {p['id'] for p in res.data['results']}
        self.assertNotIn(self.pending_prop.id, returned_ids)
        self.assertNotIn(self.rejected_prop.id, returned_ids)
        self.assertNotIn(self.inactive_prop.id, returned_ids)

    def test_my_properties_returns_only_authenticated_owners_properties_with_pagination(self):
        self.client.force_authenticate(user=self.owner)
        res = self.client.get(self.list_url, {'my_properties': 'true'})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('count', res.data)
        self.assertEqual(res.data['count'], 28)
        self.assertEqual(len(res.data['results']), 12)
        for item in res.data['results']:
            self.assertEqual(item['owner'], self.owner.id)

    def test_unpublished_properties_remain_hidden_from_other_users(self):
        self.client.force_authenticate(user=self.other_user)
        res = self.client.get(self.list_url, {'page_size': 50})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        returned_ids = {p['id'] for p in res.data['results']}
        self.assertNotIn(self.pending_prop.id, returned_ids)
        self.assertNotIn(self.rejected_prop.id, returned_ids)
        self.assertNotIn(self.inactive_prop.id, returned_ids)

    def test_property_detail_endpoints_remain_unpaginated_individual_objects(self):
        detail_url = reverse('property-detail', kwargs={'pk': self.approved_props[0].id})
        res = self.client.get(detail_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIsInstance(res.data, dict)
        self.assertNotIn('results', res.data)
        self.assertEqual(res.data['id'], self.approved_props[0].id)
        self.assertEqual(res.data['title'], self.approved_props[0].title)

    def test_property_images_endpoint_remains_unpaginated_list(self):
        img_url = reverse('property-image-list-create', kwargs={'property_pk': self.approved_props[0].id})
        res = self.client.get(img_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIsInstance(res.data, list)


class PropertyLocationAndMappingTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username='admin_loc', email='admin_loc@example.com', password='password123', role='ADMIN'
        )
        self.user = User.objects.create_user(
            username='user_loc', email='user_loc@example.com', password='password123', role='USER'
        )
        pv = PhoneVerification.create_challenge(
            phone='+919876543210',
            raw_otp='123456',
            user=self.user
        )
        pv.is_verified = True
        pv.save()
        # Create verified property in Telangana / Hyderabad
        self.prop_hyd = Property.objects.create(
            owner=self.admin,
            title='Hyderabad Flat',
            description='In Banjara Hills',
            property_type='APARTMENT',
            listing_type='SALE',
            price=7500000.00,
            area=1500.00,
            address='Road No 12',
            state='Telangana',
            district='Hyderabad',
            city='Hyderabad',
            locality='Banjara Hills',
            pincode='500034',
            latitude=17.415600,
            longitude=78.435700,
            status='ACTIVE',
            verification_status='APPROVED'
        )
        # Create verified property in Andhra Pradesh / Visakhapatnam
        self.prop_vizag = Property.objects.create(
            owner=self.admin,
            title='Vizag Beach Villa',
            description='Near MVP Colony',
            property_type='VILLA',
            listing_type='SALE',
            price=12000000.00,
            area=2500.00,
            address='Sector 3',
            state='Andhra Pradesh',
            district='Visakhapatnam',
            city='Visakhapatnam City',
            locality='MVP Colony',
            pincode='530017',
            latitude=17.741900,
            longitude=83.337200,
            status='ACTIVE',
            verification_status='APPROVED'
        )

    def test_locations_metadata_endpoint(self):
        url = reverse('property-locations')
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('metadata', res.data)
        self.assertIn('locations', res.data)
        self.assertEqual(res.data['metadata']['source'], 'Government of Telangana (telangana.gov.in), Government of Andhra Pradesh (ap.gov.in), OpenStreetMap')
        self.assertIn('Telangana', res.data['locations'])
        self.assertIn('Andhra Pradesh', res.data['locations'])

    def test_create_property_with_valid_location_and_coordinates(self):
        self.client.force_authenticate(user=self.user)
        url = reverse('property-list-create')
        data = {
            'title': 'New Madhapur Apt',
            'description': 'Near Hitec City',
            'property_type': 'APARTMENT',
            'listing_type': 'RENT',
            'price': 45000.00,
            'area': 1200.00,
            'address': 'Plot 45, Street 2',
            'state': 'Telangana',
            'district': 'Rangareddy',
            'city': 'Cyberabad / Serilingampally',
            'locality': 'Madhapur',
            'pincode': '500081',
            'contact_phone': '+91 98765 43210',
            'latitude': 17.448300,
            'longitude': 78.391500
        }
        res = self.client.post(url, data)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['state'], 'Telangana')
        self.assertEqual(res.data['district'], 'Rangareddy')
        self.assertEqual(res.data['city'], 'Cyberabad / Serilingampally')
        self.assertEqual(res.data['locality'], 'Madhapur')
        self.assertAlmostEqual(float(res.data['latitude']), 17.448300, places=4)
        self.assertAlmostEqual(float(res.data['longitude']), 78.391500, places=4)

    def test_create_property_with_invalid_district_fails(self):
        self.client.force_authenticate(user=self.user)
        url = reverse('property-list-create')
        data = {
            'title': 'Invalid District Prop',
            'description': 'Mismatched state and district',
            'property_type': 'APARTMENT',
            'listing_type': 'RENT',
            'price': 30000.00,
            'area': 1000.00,
            'address': 'Main road',
            'state': 'Telangana',
            'district': 'Visakhapatnam',  # Visakhapatnam is in Andhra Pradesh, NOT Telangana
            'city': 'Hyderabad',
            'pincode': '500001',
            'contact_phone': '+919876543210'
        }
        res = self.client.post(url, data)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('location', res.data)
        self.assertIn('does not belong to state', str(res.data['location']))

    def test_create_property_with_custom_city_and_locality_succeeds(self):
        self.client.force_authenticate(user=self.user)
        url = reverse('property-list-create')
        data = {
            'title': 'Custom City and Locality Prop',
            'description': 'User defined custom city and locality in valid district',
            'property_type': 'APARTMENT',
            'listing_type': 'RENT',
            'price': 30000.00,
            'area': 1000.00,
            'address': 'Main road',
            'state': 'Telangana',
            'district': 'Hyderabad',
            'city': 'My Custom Town',
            'locality': 'Greenwood Enclave',
            'pincode': '500001',
            'contact_phone': '+919876543210'
        }
        res = self.client.post(url, data)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['city'], 'My Custom Town')
        self.assertEqual(res.data['locality'], 'Greenwood Enclave')
        self.assertEqual(res.data['district'], 'Hyderabad')
        self.assertEqual(res.data['state'], 'Telangana')

    def test_create_property_with_out_of_bounds_coordinates_fails(self):
        self.client.force_authenticate(user=self.user)
        url = reverse('property-list-create')
        data = {
            'title': 'Invalid Coords Prop',
            'description': 'Bad lat and lng',
            'property_type': 'APARTMENT',
            'listing_type': 'RENT',
            'price': 30000.00,
            'area': 1000.00,
            'address': 'Road 1',
            'state': 'Telangana',
            'district': 'Hyderabad',
            'city': 'Hyderabad',
            'locality': 'Banjara Hills',
            'pincode': '500034',
            'latitude': 120.0,  # Invalid latitude > 90
            'longitude': 78.4357,
            'contact_phone': '+919876543210'
        }
        res = self.client.post(url, data)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('latitude', res.data)

    def test_filter_properties_by_district(self):
        url = reverse('property-list-create') + '?district=Hyderabad'
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data.get('results', [])
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['district'], 'Hyderabad')

        url_vizag = reverse('property-list-create') + '?district=Visakhapatnam'
        res_vizag = self.client.get(url_vizag)
        self.assertEqual(res_vizag.status_code, status.HTTP_200_OK)
        results_vizag = res_vizag.data.get('results', [])
        self.assertEqual(len(results_vizag), 1)
        self.assertEqual(results_vizag[0]['district'], 'Visakhapatnam')

    def test_filter_properties_by_state_and_district(self):
        url = reverse('property-list-create') + '?state=Telangana&district=Hyderabad'
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data.get('results', [])
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['title'], 'Hyderabad Flat')





