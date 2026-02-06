from django.db import models
from django.utils.translation import gettext_lazy as _

from hmx import api


class Partner(models.Model):
    class Meta:
        inherit = 'partner'

    refferal_id = models.ForeignKey("partners.partner", verbose_name=_("Refferal"), null=True, on_delete=models.CASCADE)
    m2m_sale_ids = models.ManyToManyField("sale.sale", verbose_name=_("Sales M2M"))

    @api.onchange('name')
    def onchange_name(self):
        # normal fields
        if not self.name:
            self.email = None
        else:
            self.email = f"{self.name}@example.com"

        # many2one
        if not self.name:
            self.user_id = None
        else:
            self.user_id = self.env.ref('base.user_root').id

        # one2many
        sale_values = [(5,)]
        for character in self.name or '':
            sale_values.append((0, 0, {'name': character}))
        self.sale_ids = sale_values
