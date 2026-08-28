# Configure pymysql to work with Django
import pymysql

# Monkey-patch MySQLdb to use pymysql
pymysql.install_as_MySQLdb()

# Patch version to satisfy Django 6.0 requirements
# Django 6.0 requires mysqlclient 2.2.1+, so we need to trick it
import pymysql as mysql_module
mysql_module.version_info = (2, 2, 1, "final", 0)
