import json
import os
from dotenv import load_dotenv
from myjdapi import Myjdapi

load_dotenv()

myjd = Myjdapi()
myjd.connect(os.getenv('JD_EMAIL'), os.getenv('JD_PASSWORD'))
jd = myjd.get_device(os.getenv('JD_DEVICE'))
print(json.dumps(jd.downloads.query_packages(), indent=2))
