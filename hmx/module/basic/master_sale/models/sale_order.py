import logging

from django.db import models
from django.utils.translation import gettext_lazy as _

from hmx import api
from hmx.exceptions import ValidationError


_logger = logging.getLogger(__name__)


class SaleOrder(models.Model):
    class Meta:
        name = "saleorder"
        ordering = ["name"]
        verbose_name = "Sale Quotation / Sale Order"
        verbose_name_plural = "Sale Quotations / Sale Orders"
        auto_rule = True

    STATES = [
        ("draft", "Draft"),
        ("to_approve", "Waiting for Approval"),
        ("sent", "Sent"),
        ("sale", "Sale Order"),
        ("closed", "Closed"),
        ("cancelled", "Cancelled"),
        ("rejected", "Rejected"),
        ("revised", "Revised"),
    ]

    INV_POLICIES = [
        ("on_delivered", "Delivered Quantity"),
        ("on_ordered", "Ordered Quantity"),
    ]

    DP_METHODS = [
        ("with_vat", "With VAT"),
        ("without_vat", "Without VAT"),
    ]

    state = models.CharField(
        choices=STATES,
        default="draft",
        verbose_name=_("Status"),
        tracking=True,
    )

    name = models.CharField(
        max_length=64,
        verbose_name=_("Order Reference"),
        editable=False,
    )

    sq_ref_name = models.CharField(
        max_length=64,
        verbose_name=_("SQ Reference Name"),
        editable=False,
        null=True,
    )

    customer = models.ForeignKey(
        "base.basepartner",
        on_delete=models.PROTECT,
        related_name="sale_orders",
        verbose_name=_("Customer"),
    )

    delivery_address = models.CharField(
        max_length=200,
        null=True,
        verbose_name=_("Delivery Address"),
    )

    invoice_address = models.CharField(
        max_length=200,
        null=True,
        verbose_name=_("Invoice Address"),
    )

    price_list = models.CharField(
        max_length=200,
        null=True,
        verbose_name=_("Price List"),
    )

    currency = models.ForeignKey(
        "base.basecurrency",
        on_delete=models.PROTECT,
        verbose_name=_("Currency"),
        default=lambda self: self.env.company.currency.id,
    )

    delivery_date = models.DateTimeField(
        null=True,
        verbose_name=_("Delivery Date"),
    )

    warehouse = models.CharField(
        max_length=200,
        null=True,
        verbose_name=_("Warehouse"),
    )

    location = models.CharField(
        max_length=200,
        null=True,
        verbose_name=_("Location"),
    )

    quotation_expiry_date = models.DateTimeField(
        null=True,
        verbose_name=_("Expiry Date"),
    )

    remarks = models.TextField(
        null=True,
        verbose_name=_("Remarks"),
    )

    is_sale_order = models.BooleanField(
        default=False,
        editable=False,
    )

    subtotal_sum = models.DecimalField(
        _('Subtotal'),
        max_digits=10,
        decimal_ref='master_sale.sale_order:digits_amount',
        compute="_compute_amount",
        editable=False,
    )

    total_sum = models.DecimalField(
        _('Grand Total'),
        max_digits=10,
        decimal_ref='master_sale.sale_order:digits_amount',
        compute="_compute_amount",
        editable=False,
    )

    @api.model
    def active_company(self):
        return self.env.company.id or self.env.user.company.id

    @api.model
    def default_get(self, fields_list):
        res = super().default_get(fields_list)
        res['company'] = self.active_company()
        return res

    @api.depends("order_line_ids.subtotal_lines")
    def _compute_amount(self):
        for order in self:
            subtotal = sum(order.order_line_ids.mapped("subtotal_lines"))
            order.subtotal_sum = subtotal
            order.total_sum = subtotal  # discount & tax TBC

    @api.model
    def create(self, vals):
        if not vals.get("name"):
            vals["name"] = self.env["basesequence"].next_by_code("sale.quotation") or "/"
        return super().create(vals)

    def write(self, vals):
        for order in self:
            if order.state == "closed":
                raise ValidationError(_("Closed documents cannot be modified."))
        return super().write(vals)

    @api.transition(field="state", source="draft", target="sale")
    def action_confirm(self):
        for order in self:
            order.sq_ref_name = order.name
            order.name = self.env["basesequence"].next_by_code("sale.order") or order.name
            order.write(
                {
                    "is_sale_order": True,
                }
            )
        return True

    @api.transition(field="state", source=["draft", "sale"], target="cancelled")
    def action_cancel(self):
        return True

    @api.transition(field="state", source="sale", target="closed")
    def action_close(self):
        return True


class SaleOrderLines(models.Model):
    class Meta:
        name = "saleorderlines"
        ordering = ["id"]
        verbose_name = _("Sale Order Line")
        verbose_name_plural = _("Sale Order Lines")

    order = models.ForeignKey(
        "saleorder",
        on_delete=models.CASCADE,
        related_name="order_line_ids",
        verbose_name=_("Order"),
    )

    product_lines = models.ForeignKey(
        "product",
        on_delete=models.PROTECT,
        verbose_name=_("Product"),
    )

    product_description = models.CharField(
        max_length=255,
        null=True,
        verbose_name=_("Description"),
    )

    warehouse_lines = models.CharField(
        max_length=200,
        null=True,
        verbose_name=_("Warehouse"),
    )

    location_lines = models.CharField(
        max_length=200,
        null=True,
        verbose_name=_("Location"),
    )

    delivery_lines = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        verbose_name=_("Delivery Address"),
    )

    delivery_date_lines = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name=_("Delivery Date"),
    )

    quantity_lines = models.DecimalField(
        _('Quantity'),
        max_digits=10,
        decimal_ref='master_sale.sale_order:digits_quantity',
    )

    uom_lines = models.CharField(
        max_length=200,
        null=True,
        verbose_name=_("Unit of Measure"),
    )

    unit_price_lines = models.DecimalField(
        _('Unit Price'),
        max_digits=10,
        decimal_ref='master_sale.sale_order:digits_amount',
    )

    subtotal_lines = models.DecimalField(
        _('Subtotal'),
        max_digits=10,
        decimal_ref='master_sale.sale_order:digits_amount',
        compute="_compute_subtotal_lines",
        editable=False,
    )

    @api.depends("quantity_lines", "unit_price_lines")
    def _compute_subtotal_lines(self):
        for line in self:
            qty = line.quantity_lines or 0.0
            price = line.unit_price_lines or 0.0
            line.subtotal_lines = qty * price

    @api.onchange("product_lines")
    def _onchange_product_lines(self):
        if not self.product_lines:
            self.product_description = False
            return

        self.product_description = self.product_lines.description
        self.unit_price_lines = self.product_lines.list_price

        if self.order and self.order.delivery_date and not self.delivery_date_lines:
            self.delivery_date_lines = self.order.delivery_date

        _logger.warning("id=%s | order=%s", self.id, self.order.id if self.order else None)

    @api.constrains("quantity_lines")
    def _check_quantity_positive(self):
        for line in self:
            if line.quantity_lines <= 0:
                raise ValidationError(_("Quantity must be greater than zero."))
