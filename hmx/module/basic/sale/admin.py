from django.contrib import admin
from sale.models.sale import Sale
from django.utils.translation import gettext_lazy as _

@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = ('name', 'partner_id')


