from rest_framework.pagination import PageNumberPagination


class PropertyPagination(PageNumberPagination):
    """
    Dedicated pagination class for property listings.
    Defaults to 12 properties per page.
    Allows clients to override page_size up to a maximum of 50.
    """
    page_size = 12
    page_size_query_param = 'page_size'
    max_page_size = 50
