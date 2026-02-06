from hmx import http
from hmx.http import request


class SaleController(http.Controller):
    
    @http.route('/sale/orders', type='http', auth='user', methods=['GET'])
    def list_orders(self, **kwargs):
        orders = request.env['sale.order'].search([])
        return request.render('sale.order_list', {'orders': orders})
    
    @http.route('/sale/order/<int:order_id>', type='http', auth='user', methods=['GET'])
    def view_order(self, order_id, **kwargs):
        order = request.env['sale.order'].browse(order_id)
        if not order.exists():
            return request.not_found()
        return request.render('sale.order_view', {'order': order})
    
    @http.route('/sale/order/create', type='http', auth='user', methods=['GET', 'POST'])
    def create_order(self, **kwargs):
        if request.httprequest.method == 'POST':
            vals = {
                'partner_id': int(kwargs.get('partner_id')),
                'date_order': kwargs.get('date_order'),
            }
            order = request.env['sale.order'].create(vals)
            return request.redirect(f'/sale/order/{order.id}')
        
        partners = request.env['res.partner'].search([])
        return request.render('sale.order_create', {'partners': partners})
    
    @http.route('/sale/order/<int:order_id>/confirm', type='json', auth='user', methods=['POST'])
    def confirm_order(self, order_id, **kwargs):
        order = request.env['sale.order'].browse(order_id)
        if order.exists():
            order.action_confirm()
            return {'success': True, 'state': order.state}
        return {'success': False, 'error': 'Order not found'}
