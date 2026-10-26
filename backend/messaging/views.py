from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from django.db.models import Q
from django.shortcuts import get_object_or_404
from .models import Conversation, Message
from .serializers import ConversationSerializer, MessageSerializer
from properties.models import Property

class ConversationListCreateView(generics.ListCreateAPIView):
    serializer_class = ConversationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return Conversation.objects.filter(Q(customer=user) | Q(owner=user)).order_by('-updated_at')

    def create(self, request, *args, **kwargs):
        property_id = request.data.get('property_id')
        if not property_id:
            return Response({"detail": "property_id is required."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            prop = Property.objects.get(id=property_id)
        except Property.DoesNotExist:
            return Response({"detail": "Property not found."}, status=status.HTTP_404_NOT_FOUND)

        if prop.owner == request.user:
            return Response({"detail": "You cannot message yourself about your own property."}, status=status.HTTP_403_FORBIDDEN)

        # Get or create conversation
        conversation, created = Conversation.objects.get_or_create(
            customer=request.user,
            owner=prop.owner,
            property=prop
        )
        
        serializer = self.get_serializer(conversation)
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class ConversationDetailView(generics.RetrieveAPIView):
    serializer_class = ConversationSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        return Conversation.objects.filter(Q(customer=user) | Q(owner=user))


class MessageListCreateView(generics.ListCreateAPIView):
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        conversation_id = self.kwargs.get('conversation_id')
        user = self.request.user
        # Ensure user is part of the conversation
        get_object_or_404(Conversation, id=conversation_id, customer=user) if not Conversation.objects.filter(id=conversation_id, owner=user).exists() else None
        
        # We need to properly check permissions without a weird inline if
        conversation = get_object_or_404(Conversation, id=conversation_id)
        if conversation.customer != user and conversation.owner != user:
            return Message.objects.none()
            
        return Message.objects.filter(conversation=conversation).order_by('created_at')

    def list(self, request, *args, **kwargs):
        conversation_id = self.kwargs.get('conversation_id')
        user = self.request.user
        conversation = get_object_or_404(Conversation, id=conversation_id)
        
        if conversation.customer != user and conversation.owner != user:
            return Response({"detail": "Not found or forbidden."}, status=status.HTTP_403_FORBIDDEN)
            
        # Mark unread messages as read
        unread_messages = Message.objects.filter(conversation=conversation, is_read=False).exclude(sender=user)
        unread_messages.update(is_read=True)
        
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        conversation_id = self.kwargs.get('conversation_id')
        user = self.request.user
        
        conversation = get_object_or_404(Conversation, id=conversation_id)
        if conversation.customer != user and conversation.owner != user:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
            
        content = request.data.get('content', '').strip()
        if not content:
            return Response({"detail": "Message content cannot be empty."}, status=status.HTTP_400_BAD_REQUEST)
        if len(content) > 5000:
            return Response({"detail": "Message too long."}, status=status.HTTP_400_BAD_REQUEST)
            
        message = Message.objects.create(
            conversation=conversation,
            sender=user,
            content=content
        )
        
        # Update conversation timestamp
        conversation.save() # auto_now=True will update updated_at
        
        serializer = self.get_serializer(message)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
