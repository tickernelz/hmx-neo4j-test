{
    "name": "Sale",
    "category": "Sale",
    "version": "1.0",
    "depends": ["partners", "product", "onboarding", "approval_workflow", "core_forecast"],
    "data": [
        "data/sequence.xml",
        "data/base_decimal_accuracy_data.xml",
        "data/onboarding_data.xml",
        "security/base.model.access.csv",
        "security/security.xml",
        "security/restrict.xml",
        "views/sale_views.xml",
        "views/partners_views.xml",
        "views/products_views.xml",
        "reports/sale_report_views.xml",
        "data/base_report_data.xml",
        "data/forecast_data.xml",
    ],
    "assets": {
        "onboarding": ["onboarding/sale_onboarding.json"],
    },
}
