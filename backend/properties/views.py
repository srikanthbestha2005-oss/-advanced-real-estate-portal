from rest_framework import generics, filters, serializers
from rest_framework.permissions import IsAuthenticatedOrReadOnly, IsAuthenticated
from .permissions import IsAdminRoleOrReadOnly, IsOwnerOrAdmin
from django_filters.rest_framework import DjangoFilterBackend
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied, NotAuthenticated
from django.db import transaction

from .models import Property, PropertyImage
from .serializers import PropertySerializer, PropertyImageSerializer
from .filters import PropertyFilter
from .pagination import PropertyPagination


class PropertyListCreateView(generics.ListCreateAPIView):
    serializer_class = PropertySerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    pagination_class = PropertyPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = PropertyFilter
    search_fields = ['title', 'description', 'city', 'district', 'locality', 'state', 'address']
    ordering_fields = ['price', 'area', 'created_at']
    ordering = ['-created_at']

    def get_queryset(self):
        user = self.request.user
        my_properties = self.request.query_params.get('my_properties', '').strip().lower() in ('true', '1')

        if my_properties:
            if not user.is_authenticated:
                raise NotAuthenticated("Authentication credentials were not provided to view your properties.")
            return Property.objects.filter(owner=user).order_by('-created_at')

        if user.is_authenticated and user.role == 'ADMIN':
            return Property.objects.all()
        
        if user.is_authenticated:
            # Own properties OR active and approved properties
            return Property.objects.filter(status='ACTIVE', verification_status='APPROVED') | Property.objects.filter(owner=user)
        
        return Property.objects.filter(status='ACTIVE', verification_status='APPROVED')

    def perform_create(self, serializer):
        user = self.request.user
        kwargs = {'owner': user}

        if user.role == 'ADMIN':
            if 'verification_status' in self.request.data:
                valid_verif = [choice[0] for choice in Property.VERIFICATION_CHOICES]
                verif_status = self.request.data['verification_status']
                if verif_status not in valid_verif:
                    raise serializers.ValidationError({
                        'verification_status': f"Invalid verification_status '{verif_status}'. Valid choices are: {valid_verif}"
                    })
                kwargs['verification_status'] = verif_status

            if 'status' in self.request.data:
                valid_status = [choice[0] for choice in Property.STATUS_CHOICES]
                status_val = self.request.data['status']
                if status_val not in valid_status:
                    raise serializers.ValidationError({
                        'status': f"Invalid status '{status_val}'. Valid choices are: {valid_status}"
                    })
                kwargs['status'] = status_val
        else:
            kwargs['verification_status'] = 'APPROVED'
            kwargs['status'] = 'ACTIVE'

        with transaction.atomic():
            serializer.save(**kwargs)


class PropertyDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = PropertySerializer
    permission_classes = [IsAuthenticatedOrReadOnly, IsOwnerOrAdmin]

    def get_queryset(self):
        user = self.request.user
        if user.is_authenticated and user.role == 'ADMIN':
            return Property.objects.all()
        if user.is_authenticated:
            return Property.objects.filter(status='ACTIVE', verification_status='APPROVED') | Property.objects.filter(owner=user)
        return Property.objects.filter(status='ACTIVE', verification_status='APPROVED')
        
    def perform_update(self, serializer):
        # Because verification_status and status are read_only in the serializer,
        # we must explicitly validate and pass them if an admin is saving them.
        user = self.request.user
        kwargs = {}
        if user.role == 'ADMIN':
            if 'verification_status' in self.request.data:
                valid_verif = [choice[0] for choice in Property.VERIFICATION_CHOICES]
                verif_status = self.request.data['verification_status']
                if verif_status not in valid_verif:
                    raise serializers.ValidationError({
                        'verification_status': f"Invalid verification_status '{verif_status}'. Valid choices are: {valid_verif}"
                    })
                kwargs['verification_status'] = verif_status

            if 'status' in self.request.data:
                valid_status = [choice[0] for choice in Property.STATUS_CHOICES]
                status_val = self.request.data['status']
                if status_val not in valid_status:
                    raise serializers.ValidationError({
                        'status': f"Invalid status '{status_val}'. Valid choices are: {valid_status}"
                    })
                kwargs['status'] = status_val

        with transaction.atomic():
            serializer.save(**kwargs)

    def perform_destroy(self, instance):
        with transaction.atomic():
            instance.delete()



class PropertyImageListCreateView(generics.ListCreateAPIView):
    serializer_class = PropertyImageSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    pagination_class = None

    def get_queryset(self):
        property_id = self.kwargs.get('property_pk')
        user = self.request.user
        qs = PropertyImage.objects.filter(property_id=property_id)
        
        if user.is_authenticated:
            if user.role == 'ADMIN':
                return qs.order_by('display_order', 'id')
            try:
                prop = Property.objects.get(id=property_id)
                if prop.owner == user:
                    return qs.order_by('display_order', 'id')
            except Property.DoesNotExist:
                pass
                
        return qs.filter(is_active=True).order_by('display_order', 'id')

    def perform_create(self, serializer):
        property_id = self.kwargs.get('property_pk')
        prop = get_object_or_404(Property, id=property_id)
        user = self.request.user
        
        if not user.is_authenticated:
            raise PermissionDenied("You must be logged in to upload images.")
            
        if user.role != 'ADMIN' and prop.owner != user:
            raise PermissionDenied("You do not have permission to add images to this property.")
            
        with transaction.atomic():
            instance = serializer.save(property=prop)
            if instance.is_primary:
                PropertyImage.objects.filter(property=prop).exclude(pk=instance.pk).update(is_primary=False)


class PropertyImageDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = PropertyImageSerializer
    permission_classes = [IsAuthenticatedOrReadOnly, IsOwnerOrAdmin]

    def get_queryset(self):
        user = self.request.user
        qs = PropertyImage.objects.all()
        if user.is_authenticated and user.role == 'ADMIN':
            return qs
        if user.is_authenticated:
            return qs
        return qs.filter(is_active=True)

    def perform_update(self, serializer):
        with transaction.atomic():
            instance = serializer.save()
            if instance.is_primary:
                PropertyImage.objects.filter(property=instance.property).exclude(pk=instance.pk).update(is_primary=False)


from rest_framework.views import APIView
from rest_framework.response import Response
from .location_data import LOCATION_DATA, LOCATION_DATA_METADATA

class LocationListView(APIView):
    permission_classes = []

    def get(self, request):
        return Response({
            'metadata': LOCATION_DATA_METADATA,
            'locations': LOCATION_DATA
        })
