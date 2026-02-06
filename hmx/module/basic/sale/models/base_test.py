from django.db import models


class BaseTest(models.Model):
    """
    Sale module extension of the ``basetest`` model.

    Inherits the base model and applies targeted field mutations
    (attributes, selections, compute/store behavior, and field types)
    to validate cross-module inheritance.
    """

    class Meta:
        inherit = 'basetest'

    over_attrs = models.TextField(
        max_length=100,
        help_text='Over Attrs Help (Sale)',
        verbose_name='Over Attrs String (Sale)',
        db_index=False,
        editable=False,
        description="- Change size to 100.\n"
        "- Change help to `Over Attrs Help (Sale)`.\n"
        "- Change label to `Over Attrs String (Sale)`.\n"
        "- Set index to False.\n"
        "- Set to readonly.\n",
    )

    over_selection = models.CharField(
        verbose_name='Over Selection (Sale)',
        choices_add=[
            ('c', 'C (Sale)'),
            ('d',),
        ],
        description="- Add `C (Sale)` selection, and put before `D (Base)`.\n"
        "- Change label to `Over Selection (Sale)`.",
    )

    over_store = models.ManyToManyField(
        'base.basecurrency',
        compute='_compute_over_store',
        verbose_name='Over Store (Sale)',
        description='- Change this field to compute & not stored.\n- Change label to `Over Store (Sale)`.',
    )

    over_type = models.IntegerField(
        null=True,
        blank=True,
        verbose_name='Over Type (Sale)',
        description="- Change field type to `integer`.\n- Change label to `Over Type (Sale)`.",
    )

    def _compute_over_store(self):
        self.over_store = [(5,)]
