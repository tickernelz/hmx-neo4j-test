from django.db import models


class Product(models.Model):
    class Meta:
        inherit = 'product'
