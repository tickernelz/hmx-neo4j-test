from django.db import models
from django.utils.translation import gettext_lazy as _
from hmx import api
import numpy as np




class Products(models.Model):
    class Meta:
        inherit = 'products'

    total_sales = models.FloatField(null=True, compute='_compute_sale_total', verbose_name=_("Sales Total") ) 


    def total_sale(self):
        if self.orderline:
            total = sum(self.orderline.mapped("quantity"))
        return total



    # @api.depends('orderline')
    def _compute_sale_total(self):
        
        total = 0
        for record in self:
            # import cython jika ada, fallback ke python biasa
            # try:
            # import sale.cython.product as cython_compute
            # from sale.cython import product as cython_compute
            total_sale = sum(record.orderline.mapped("quantity"))                
            # total_sale = cython_compute.compute_sol(sale_array)
            # except ImportError:
            #     total_sale = record.total_sale()
            print (total_sale,'fff')
            record.total_sales = total_sale