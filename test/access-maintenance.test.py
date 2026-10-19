import datetime as dt
import gzip
import importlib.util
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest
import sys
sys.dont_write_bytecode = True

spec = importlib.util.spec_from_file_location('maintenance', Path(__file__).resolve().parents[1] / 'server/access-maintenance.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class Retention(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp(prefix='dn-retention-')).resolve()
        self.logs = self.root / 'logs'
        self.visitors = self.root / 'visitors'
        self.logs.mkdir()
        self.visitors.mkdir()
        self.now = dt.datetime(2026, 9, 1, 3, 30, tzinfo=m.JST)

    def log(self, age, name):
        path = self.logs / name
        path.write_bytes((json.dumps({'ts': (self.now-dt.timedelta(days=age)).timestamp(), 'request': {'uri': '/'}})+'\n').encode())
        return path

    def test_monthly_and_restore(self):
        old = self.log(186, 'access-v2-2026-03-01T00-00-00-time.log')
        raw = old.read_bytes()
        fresh = self.log(179, 'access-v2-2026-03-04T00-00-00-time.log')
        active = self.log(211, 'access-v3.log')
        result = m.maintain(self.logs, self.visitors, self.now)
        self.assertEqual(len(result['logs']), 1)
        self.assertFalse(old.exists())
        self.assertTrue(fresh.exists() and active.exists())
        self.assertEqual(result['file_index'][fresh.name]['bytes'], fresh.stat().st_size)
        self.assertEqual(result['file_index'][fresh.name]['first'], (self.now-dt.timedelta(days=179)).timestamp())
        self.assertNotIn(active.name, result['file_index'])
        archive = next((self.logs/'archive').glob('*/*.gz'))
        self.assertEqual(gzip.decompress(archive.read_bytes()), raw)
        self.assertEqual(m.maintain(self.logs, self.visitors, self.now)['logs'], [])

    def test_manual_monthly_and_last_monthly(self):
        m.maintain(self.logs, self.visitors, self.now)
        self.now += dt.timedelta(days=1)
        fresh = self.log(180, 'access-2026-02-06T00-00-00-time.log')
        old = self.log(190, 'access-2026-02-01T00-00-00-time.log')
        result = m.maintain(self.logs, self.visitors, self.now)
        self.assertEqual(result['mode'], 'monthly')
        self.assertIsNotNone(result['last_monthly'])
        self.assertTrue(fresh.exists())
        self.assertFalse(old.exists())

    def test_corrupt_or_different_archive_retains_source(self):
        old = self.log(186, 'access.log')
        target = m.archive_path(self.logs, '2026-H1', 'access.log.gz')
        target.write_bytes(gzip.compress(b'different'))
        with self.assertRaises(RuntimeError):
            m.maintain(self.logs, self.visitors, self.now)
        self.assertTrue(old.exists())
        self.assertEqual(json.loads((self.logs/'maintenance.json').read_text())['status'], 'error')

    def test_incomplete_file_retained(self):
        old = self.log(186, 'access.log')
        old.write_bytes(old.read_bytes()[:-1])
        with self.assertRaises(RuntimeError):
            m.maintain(self.logs, self.visitors, self.now)
        self.assertTrue(old.exists())

    def test_visitors_backup_before_delete(self):
        database = self.visitors / 'visitors.sqlite'
        db = sqlite3.connect(database)
        db.execute('CREATE TABLE visits(day TEXT,visitor TEXT,path TEXT,PRIMARY KEY(day,visitor,path)) WITHOUT ROWID')
        db.executemany('INSERT INTO visits VALUES(?,?,?)', [('2026-02-28','a'*64,'/'),('2026-08-31','b'*64,'/')])
        db.commit()
        result = m.maintain(self.logs, self.visitors, self.now)
        self.assertEqual(result['visitors'][0]['rows'], 1)
        restored = json.loads(gzip.decompress(next((self.visitors/'archive').glob('*/*.gz')).read_bytes()))
        self.assertEqual(restored['visitor'], 'a'*64)
        self.assertEqual(db.execute('SELECT day FROM visits').fetchall(), [('2026-08-31',)])
        self.assertEqual(db.execute('PRAGMA integrity_check').fetchone()[0], 'ok')
        db.close()

    def test_visitor_backup_conflict_rolls_back(self):
        db = sqlite3.connect(self.visitors / 'visitors.sqlite')
        db.execute('CREATE TABLE visits(day TEXT,visitor TEXT,path TEXT)')
        db.execute("INSERT INTO visits VALUES('2026-02-28','anonymous','/')")
        db.commit()
        target = m.archive_path(self.visitors, '2026-H1', 'visitors-2026-02-28.jsonl.gz')
        target.write_bytes(gzip.compress(b'wrong copy'))
        with self.assertRaises(RuntimeError):
            m.maintain(self.logs, self.visitors, self.now)
        self.assertEqual(db.execute('SELECT COUNT(*) FROM visits').fetchone()[0], 1)
        db.close()

    def test_exclusion_backup_and_retention(self):
        db = sqlite3.connect(self.visitors / 'visitors.sqlite')
        db.execute('CREATE TABLE visits(day TEXT,visitor TEXT,path TEXT)')
        db.execute('CREATE TABLE excluded_visitors(day TEXT,visitor TEXT,reason TEXT,PRIMARY KEY(day,visitor)) WITHOUT ROWID')
        db.executemany('INSERT INTO excluded_visitors VALUES(?,?,?)', [('2026-02-28','a'*64,'ai'),('2026-08-31','b'*64,'automation')])
        db.commit()
        result = m.maintain(self.logs, self.visitors, self.now)
        self.assertEqual(result['visitors'][0]['table'], 'excluded_visitors')
        archive = next((self.visitors/'archive').glob('*/excluded-visitors-*.gz'))
        self.assertEqual(json.loads(gzip.decompress(archive.read_bytes()))['reason'], 'ai')
        self.assertEqual(db.execute('SELECT day FROM excluded_visitors').fetchall(), [('2026-08-31',)])
        self.assertEqual(m.maintain(self.logs, self.visitors, self.now)['visitors'], [])
        db.close()

    def test_exclusion_conflict_preserves_original(self):
        db = sqlite3.connect(self.visitors / 'visitors.sqlite')
        db.execute('CREATE TABLE excluded_visitors(day TEXT,visitor TEXT,reason TEXT)')
        db.execute("INSERT INTO excluded_visitors VALUES('2026-02-28','anonymous','ai')")
        db.commit()
        target = m.archive_path(self.visitors, '2026-H1', 'excluded-visitors-2026-02-28.jsonl.gz')
        target.write_bytes(gzip.compress(b'wrong copy'))
        with self.assertRaises(RuntimeError):
            m.maintain(self.logs, self.visitors, self.now)
        self.assertEqual(db.execute('SELECT COUNT(*) FROM excluded_visitors').fetchone()[0], 1)
        db.close()


    def test_calendar_boundary_and_half_year(self):
        self.assertEqual(m.six_months_ago(dt.datetime(2026, 8, 31, 3, tzinfo=m.JST)), dt.datetime(2026, 2, 28, tzinfo=m.JST))
        self.assertEqual(m.six_months_ago(dt.datetime(2024, 8, 31, 3, tzinfo=m.JST)), dt.datetime(2024, 2, 29, tzinfo=m.JST))
        self.assertEqual(m.half_year(dt.date(2026, 6, 30)), '2026-H1')
        self.assertEqual(m.half_year(dt.date(2026, 7, 1)), '2026-H2')
        boundary = self.logs / 'access-v3-2026-03-01T00-00-00-time.log'
        boundary.write_text(json.dumps({'ts': m.six_months_ago(self.now).timestamp()})+'\n')
        result = m.maintain(self.logs, self.visitors, self.now)
        self.assertTrue(boundary.exists())
        self.assertEqual(result['retention_months'], 6)
        self.assertEqual(result['archive_grouping'], 'half_year')


if __name__ == '__main__':
    unittest.main()
