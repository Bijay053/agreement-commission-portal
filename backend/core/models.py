from django.db import models


class Country(models.Model):
    id = models.AutoField(primary_key=True)
    iso2 = models.CharField(max_length=2, unique=True)
    name = models.CharField(max_length=128)

    class Meta:
        managed = False
        db_table = 'countries'

    def __str__(self):
        return self.name
