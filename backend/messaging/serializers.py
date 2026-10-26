from rest_framework import serializers
from .models import Conversation, Message
from properties.models import Property, PropertyImage

class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ['id', 'conversation', 'sender', 'content', 'is_read', 'created_at']
        read_only_fields = ['id', 'conversation', 'sender', 'created_at', 'is_read']

class ConversationSerializer(serializers.ModelSerializer):
    property_title = serializers.CharField(source='property.title', read_only=True)
    property_image = serializers.SerializerMethodField(read_only=True)
    customer_email = serializers.CharField(source='customer.email', read_only=True)
    owner_email = serializers.CharField(source='owner.email', read_only=True)
    last_message = serializers.SerializerMethodField(read_only=True)
    unread_count = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Conversation
        fields = ['id', 'customer', 'owner', 'property', 'property_title', 'property_image', 
                  'customer_email', 'owner_email', 'last_message', 'unread_count', 'updated_at', 'created_at']
        read_only_fields = ['id', 'customer', 'owner', 'updated_at', 'created_at']

    def get_property_image(self, obj):
        primary_image = obj.property.images.filter(is_primary=True, is_active=True).first()
        if not primary_image:
            primary_image = obj.property.images.filter(is_active=True).order_by('display_order', 'id').first()
        
        if primary_image and primary_image.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(primary_image.image.url)
            return primary_image.image.url
        return None

    def get_last_message(self, obj):
        last_msg = obj.messages.order_by('-created_at').first()
        if last_msg:
            return {
                'content': last_msg.content[:50] + ('...' if len(last_msg.content) > 50 else ''),
                'created_at': last_msg.created_at,
                'sender': last_msg.sender.id
            }
        return None
        
    def get_unread_count(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return 0
        return obj.messages.exclude(sender=request.user).filter(is_read=False).count()

