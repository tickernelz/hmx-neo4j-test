from django.db import models

from hmx import api


class BaseConfigParameter(models.Model):
    class Meta:
        inherit = 'baseconfigparameter'

    @api.model
    def get_hashy_secret_key(self):
        param = self.search([('key', '=', 'hashy_secret_key')], limit=1)
        return param.value if param else None

    @api.model
    def set_hashy_secret_key(self, value):
        param = self.search([('key', '=', 'hashy_secret_key')], limit=1)
        if param:
            param.write({'value': value})
        else:
            self.create({'key': 'hashy_secret_key', 'value': value})
        return True
