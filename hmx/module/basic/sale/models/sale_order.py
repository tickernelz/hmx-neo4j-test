from hmx import models, fields, api


class SaleOrder(models.Model):
    _name = 'sale.order'
    _description = 'Sales Order'
    
    name = fields.Char(string='Order Reference', required=True, copy=False, readonly=True, default='New')
    partner_id = fields.Many2one('res.partner', string='Customer', required=True)
    date_order = fields.Datetime(string='Order Date', required=True, default=fields.Datetime.now)
    state = fields.Selection([
        ('draft', 'Quotation'),
        ('sent', 'Quotation Sent'),
        ('sale', 'Sales Order'),
        ('done', 'Locked'),
        ('cancel', 'Cancelled'),
    ], string='Status', readonly=True, copy=False, default='draft')
    
    order_line = fields.One2many('sale.order.line', 'order_id', string='Order Lines')
    amount_total = fields.Float(string='Total', compute='_compute_amount_total', store=True)
    
    @api.depends('order_line.price_subtotal')
    def _compute_amount_total(self):
        for order in self:
            order.amount_total = sum(line.price_subtotal for line in order.order_line)
    
    def action_confirm(self):
        self.write({'state': 'sale'})
        return True
    
    def action_cancel(self):
        self.write({'state': 'cancel'})
        return True


class SaleOrderLine(models.Model):
    _name = 'sale.order.line'
    _description = 'Sales Order Line'
    
    order_id = fields.Many2one('sale.order', string='Order Reference', required=True, ondelete='cascade')
    product_id = fields.Many2one('product.product', string='Product', required=True)
    product_uom_qty = fields.Float(string='', required=True, default=1.0)
    price_unit = fields.Float(string='Unit Price', required=True)
    price_subtotal = fields.Float(string='Subtotal', compute='_compute_price_subtotal', store=True)
    
    @api.depends('product_uom_qty', 'price_unit')
    def _compute_price_subtotal(self):
        for line in self:
            line.price_subtotal = line.product_uom_qty * line.price_unit
