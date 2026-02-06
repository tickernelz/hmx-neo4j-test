import logging

from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from hmx import api, exceptions


_logger = logging.getLogger(__name__)


class BasePartner(models.Model):
    class Meta:
        inherit = "basepartner"

    customer_id = models.CharField(
        max_length=16,
        verbose_name=_("Customer Code"),
        unique=True,
        editable=True,
        null=True,
        blank=True,
    )

    customer_creation_date = models.DateTimeField(
        verbose_name=_("Customer Creation Date"),
        editable=False,
        null=True,
        blank=True,
    )

    customer_category = models.ForeignKey(
        "master_sale.salecustomercategory",
        verbose_name=_("Customer Category"),
        related_name="base_partner_ids",
        on_delete=models.CASCADE,
        null=True,
    )

    is_customer = models.BooleanField(
        compute="_compute_is_customer",
        store=True,
    )

    full_address = models.TextField(compute="_compute_full_address", store=False)

    @api.depends('partner_address_ids', 'partner_address_ids.address_type')
    def _compute_full_address(self):
        default_type = self.env.ref(
            "base.base_partner_address_type_default",
            raise_if_not_found=False,
        )

        for rec in self:
            rec.full_address = False

            if not default_type:
                continue

            default_address = rec.partner_address_ids.filtered(
                lambda a: a.address_type and a.address_type.id == default_type.id
            )

            if default_address:
                rec.full_address = default_address[0].full_address

    def action_customer_view_quick(self):
        return {
            "name": "Customer - Quick View",
            "type": "actions.act_window",
            "res_model": "base.basepartner",
            "view_mode": "quick",
            "views": [(self.env.ref("master_sale.sale_customer_form_quick").id, "quick")],
            "target": "new",
            "context": {"create": False, "edit": False},
        }

    @api.model
    def default_get(self, fields_list):
        res = super().default_get(fields_list)
        cust_type = self._get_customer_type()
        if cust_type and self.env.context.get('is_customer'):
            res['partner_types'] = cust_type
        return res

    def _get_customer_type(self):
        return self.env.ref(
            "base.base_partner_type_customer",
            raise_if_not_found=False,
        )

    def _is_customer(self):
        customer_type = self._get_customer_type()
        return bool(customer_type and customer_type.id in self.partner_types.ids)

    @api.depends("partner_types")
    def _compute_is_customer(self):
        customer_type = self._get_customer_type()
        customer_type_id = customer_type.id if customer_type else None

        for rec in self:
            partner_type_ids = set()

            for pt in rec.partner_types:
                if pt.id:
                    partner_type_ids.add(pt.id)
                elif hasattr(pt, "_origin") and pt._origin:
                    partner_type_ids.add(pt._origin.id)

            rec.is_customer = bool(customer_type_id and customer_type_id in partner_type_ids)

    @api.model
    def _generate_customer_id(self):
        seq = self.env["basesequence"].next_by_code("sale.customer")
        if not seq:
            raise exceptions.ValidationError(_("Customer sequence is not configured."))
        return seq

    @api.model_create_multi
    def create(self, vals_list):
        customer_type = self._get_customer_type()

        for vals in vals_list:
            # auto-assign customer type if category filled
            if customer_type and vals.get("customer_category") and not vals.get("partner_types"):
                vals["partner_types"] = [(6, 0, [customer_type.id])]

        records = super().create(vals_list)
        today = timezone.now()

        for rec in records:
            if not rec._is_customer():
                continue

            updates = {}

            if not rec.customer_id and not self.env.context.get("skip_customer_auto_sequence"):
                updates["customer_id"] = rec._generate_customer_id()

            if not rec.customer_creation_date:
                updates["customer_creation_date"] = today

            if updates:
                super(BasePartner, rec).write(updates)

        return records

    def write(self, vals):
        if not self.env.context.get("skip_customer_lock"):
            if "customer_id" in vals:
                raise exceptions.ValidationError(_("Customer ID cannot be modified."))
            if "customer_creation_date" in vals:
                raise exceptions.ValidationError(_("Customer Creation Date cannot be modified."))

        customer_type = self._get_customer_type()
        customer_type_id = customer_type.id if customer_type else None
        today = timezone.now()

        if "partner_types" in vals and customer_type_id:
            for rec in self:
                was_customer = rec._is_customer()

                # resolve new partner_types from commands
                new_ids = set(rec.partner_types.ids)
                for cmd in vals.get("partner_types") or []:
                    if cmd[0] == 6:  # replace
                        new_ids = set(cmd[2])
                    elif cmd[0] == 4:  # add
                        new_ids.add(cmd[1])
                    elif cmd[0] == 3:  # remove
                        new_ids.discard(cmd[1])

                is_customer = customer_type_id in new_ids

                if is_customer and not was_customer:
                    if not rec.customer_id and not self.env.context.get("skip_customer_auto_sequence"):
                        vals.setdefault("customer_id", rec._generate_customer_id())
                    if not rec.customer_creation_date:
                        vals.setdefault(
                            "customer_creation_date",
                            today,
                        )

        return super().write(vals)
