from ninja import Router
from hmx_api.registry import register_routers


sale_router = Router(tags=['sale'])

@sale_router.get("/") # will availablle in '/hmx_api/sale/'
def get_sale_index(request):
    return {"message": "Sale API is working correctly", "endpoint": "index"}

@sale_router.get("/check") # will availablle in '/hmx_api/sale/check'
def get_sale_check(request):
    return {"message": "Sale API check successful", "endpoint": "check"}


register_routers([
    ('sale/', sale_router)
])
