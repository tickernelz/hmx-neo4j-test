from django.db import models
from django.utils.translation import gettext_lazy as _


class SaleCustomerCategory(models.Model):
    class Meta:
        name = 'salecustomercategory'
        ordering = ['name']
        verbose_name = "Sale Customer Category"
        verbose_name_plural = 'Sale Customer Categories'

    name = models.CharField(max_length=255, verbose_name=_('Category Name'))
    description = models.TextField(verbose_name=_('Description'), null=True, blank=True)

    def action_view_quick(self):
        return {
            "name": "Customer Category Quick",
            "type": "Customer Category Quick",
            "res_model": "salecustomercategory",
            "view_mode": "quick",
            "views": [(self.env.ref("master_sale.view_sale_customer_category_quick").id, "quick")],
            "target": "new",
            "context": {"create": False, "edit": False},
        }
