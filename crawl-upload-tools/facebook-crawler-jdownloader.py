#!/usr/bin/env python3
"""
Facebook Video Crawler using JDownloader (Auto Mode)
===================================================
Script tự động để:
1. Đọc danh sách URL từ CSV (giống crawl-video.py)
2. Gửi video về JDownloader để tải
3. Chờ tải xong
4. Tự động upload lên TikTok/Threads/Facebook

Giống YouTube crawler nhưng cho Facebook

Author: Nguyen Dinh Huy
Date: 2026
"""

import pandas as pd
import os
import sys
import time
import json
import shutil
import subprocess
from pathlib import Path
from myjdapi import Myjdapi
import datetime

# ==================== CONFIG ====================
config_path = os.path.join(os.path.dirname(__file__), '..', 'config.json')
with open(config_path, 'r') as f:
    CONFIG = json.load(f)

JD_EMAIL = CONFIG['jdownloader']['email']
JD_PASSWORD = CONFIG['jdownloader']['password']
JD_DEVICE = CONFIG['jdownloader']['device_name']

DOWNLOAD_DIR = CONFIG['directories']['download_dir']
PROCESSED_DIR = CONFIG['directories']['processed_dir']

# ==================== CSV TRACKING ====================
def get_next_not_yet_facebook(csv_file):
    """Lấy URL Facebook tiếp theo cần crawl từ CSV"""
    df = pd.read_csv(csv_file, sep=None, engine='python')
    next_row = df[df['status'] == 'not yet'].head(1)
    if not next_row.empty:
        idx = next_row.index[0]
        url = df.at[idx, 'url']
        title = df.at[idx, 'title'] if 'title' in df.columns else f"FB_{int(time.time())}"
        # Đánh dấu done
        df.at[idx, 'status'] = 'done'
        df.to_csv(csv_file, index=False)
        return url, title
    else:
        return None, None

def mark_as_error(csv_file, url):
    """Đánh dấu URL là error"""
    try:
        df = pd.read_csv(csv_file, sep=None, engine='python')
        mask = df['url'] == url
        if mask.any():
            df.loc[mask, 'status'] = 'error'
            df.to_csv(csv_file, index=False)
    except:
        pass

# ==================== UTILITIES ====================
def ensure_directories():
    """Tạo thư mục cần thiết"""
    os.makedirs(DOWNLOAD_DIR, exist_ok=True)
    os.makedirs(PROCESSED_DIR, exist_ok=True)
    print(f"✅ Download folder: {DOWNLOAD_DIR}")
    print(f"✅ Processed folder: {PROCESSED_DIR}")

def sanitize_filename(filename):
    """Làm sạch tên file"""
    invalid_chars = '<>:"/\\|?*'
    for char in invalid_chars:
        filename = filename.replace(char, '_')
    return filename.strip()[:100]

# ==================== JDOWNLOADER FUNCTIONS ====================
def connect_to_jdownloader():
    """Kết nối tới JDownloader"""
    try:
        print("🔗 Đang kết nối tới JDownloader...")
        myjd = Myjdapi()
        myjd.connect(JD_EMAIL, JD_PASSWORD)
        device = myjd.get_device(JD_DEVICE)
        print("✅ Đã kết nối JDownloader")
        return myjd, device
    except Exception as e:
        print(f"❌ Lỗi kết nối JDownloader: {e}")
        return None, None

def download_facebook_video_via_jdownloader(device, video_url, video_title, download_dir):
    """Gửi Facebook video đến JDownloader để tải"""
    try:
        safe_title = sanitize_filename(video_title)
        package_name = f"FB_{safe_title}_{int(time.time())}"
        
        print(f"📥 Gửi link: {video_url}")
        
        # Gửi link về JDownloader
        device.linkgrabber.add_links([{
            "autostart": True,
            "links": video_url,
            "packageName": package_name,
            "extractPassword": "",
            "priority": "DEFAULT",
            "downloadPassword": "",
            "destinationFolder": download_dir
        }])
        
        print(f"✅ Gửi thành công: {package_name}")
        time.sleep(2)
        
        # Chuyển sang hàng download
        packages = device.linkgrabber.query_packages()
        package_ids = [pkg['uuid'] for pkg in packages if pkg.get('name') == package_name]
        
        if package_ids:
            device.linkgrabber.move_to_downloadlist([], package_ids)
            print(f"✅ Chuyển vào hàng download")
            return True
        else:
            print(f"⚠️ Link có thể đã được xử lý")
            return True
            
    except Exception as e:
        print(f"❌ Lỗi gửi link: {e}")
        return False

def wait_for_downloads_complete(device, timeout=1800):
    """Chờ tất cả download hoàn tất"""
    print(f"⏳ Chờ download hoàn tất (timeout: {timeout}s)...")
    start_time = time.time()
    last_status = None
    
    while time.time() - start_time < timeout:
        try:
            downloads = device.downloads.query_packages()
            if not downloads:
                print("✅ Không có download nào đang chạy")
                return True
            
            running = [d for d in downloads if not d.get('finished', True)]
            finished = [d for d in downloads if d.get('finished', True) and not d.get('stopped', False)]
            
            status_str = f"📥 Running: {len(running)} | Finished: {len(finished)}"
            if status_str != last_status:
                print(status_str)
                last_status = status_str
            
            if not running:
                print("✅ Tất cả download hoàn tất")
                return True
            
            time.sleep(5)
            
        except Exception as e:
            print(f"⚠️ Lỗi: {e}")
            time.sleep(5)
    
    print("❌ Timeout")
    return False

def get_latest_downloaded_video():
    """Lấy file video mới nhất được download"""
    try:
        if not os.path.exists(DOWNLOAD_DIR):
            return None
            
        video_extensions = ['.mp4', '.avi', '.mov', '.mkv', '.flv', '.webm']
        video_files = []
        
        for ext in video_extensions:
            video_files.extend(Path(DOWNLOAD_DIR).rglob(f'*{ext}'))
        
        if not video_files:
            return None
            
        latest_file = max(video_files, key=lambda f: f.stat().st_ctime)
        return str(latest_file)
        
    except Exception as e:
        print(f"❌ Lỗi tìm file: {e}")
        return None

# ==================== VIDEO PROCESSING ====================
def process_video_file(video_path, video_title):
    """Xử lý file video sau khi download"""
    try:
        if not os.path.exists(video_path):
            print(f"❌ File không tồn tại: {video_path}")
            return None
            
        clean_title = sanitize_filename(video_title)
        file_ext = Path(video_path).suffix
        new_filename = f"{clean_title}_{int(time.time())}{file_ext}"
        new_path = os.path.join(PROCESSED_DIR, new_filename)
        
        shutil.copy2(video_path, new_path)
        print(f"✅ Xử lý file: {new_path}")
        
        return new_path
        
    except Exception as e:
        print(f"❌ Lỗi xử lý file: {e}")
        return None

# ==================== UPLOAD FUNCTIONS ====================
def upload_to_tiktok():
    """Upload video lên TikTok"""
    try:
        print("🚀 Upload TikTok...")
        
        cmd = "cd /Users/nguyendinhhuy/Desktop/Personal\\ Project/social-upload-tools && node upload-all-platforms.mjs"
        result = subprocess.run(
            cmd,
            shell=True,
            capture_output=True,
            text=True,
            timeout=600
        )
        
        if result.returncode == 0:
            print("✅ Upload TikTok thành công!")
            return True
        else:
            print(f"⚠️ Upload TikTok: {result.stderr[:100]}")
            return False
            
    except Exception as e:
        print(f"❌ Lỗi upload TikTok: {e}")
        return False

# ==================== MAIN WORKFLOW ====================
def crawl_and_upload_single_facebook_video(myjd, device, video_url, video_title, csv_file=None):
    """Workflow hoàn chỉnh cho 1 Facebook video"""
    print(f"\n{'='*60}")
    print(f"🎬 FACEBOOK: {video_title[:50]}")
    print(f"{'='*60}")
    
    try:
        # 1. Tải video bằng JDownloader
        download_success = download_facebook_video_via_jdownloader(
            device, 
            video_url, 
            video_title,
            DOWNLOAD_DIR
        )
        
        if not download_success:
            if csv_file:
                mark_as_error(csv_file, video_url)
            return False
        
        # 2. Chờ download hoàn tất
        if not wait_for_downloads_complete(device, timeout=600):
            if csv_file:
                mark_as_error(csv_file, video_url)
            return False
        
        # 3. Tìm file video đã download
        time.sleep(3)
        video_path = get_latest_downloaded_video()
        
        if not video_path:
            print("❌ Không tìm thấy file video")
            if csv_file:
                mark_as_error(csv_file, video_url)
            return False
        
        # 4. Xử lý file
        processed_path = process_video_file(video_path, video_title)
        
        if not processed_path:
            if csv_file:
                mark_as_error(csv_file, video_url)
            return False
        
        # 5. Upload lên TikTok (optional)
        # upload_to_tiktok()
        
        print(f"\n✅ HOÀN TẤT: {video_title[:50]}")
        print(f"📁 {processed_path}")
        
        return True
        
    except Exception as e:
        print(f"❌ Lỗi: {e}")
        if csv_file:
            mark_as_error(csv_file, video_url)
        return False

def crawl_batch_from_csv(myjd, device, csv_file):
    """Crawl từng video từ CSV (giống YouTube)"""
    print(f"\n📋 Đọc từ CSV: {csv_file}")
    
    success_count = 0
    fail_count = 0
    
    while True:
        url, title = get_next_not_yet_facebook(csv_file)
        
        if not url:
            print(f"\n⚠️ Không còn URL 'not yet' để crawl")
            break
        
        success = crawl_and_upload_single_facebook_video(
            myjd, 
            device, 
            url, 
            title,
            csv_file
        )
        
        if success:
            success_count += 1
        else:
            fail_count += 1
        
        # Delay giữa các video
        time.sleep(30)
    
    print(f"\n{'='*60}")
    print(f"🎉 KẾT QUẢ BATCH:")
    print(f"✅ Thành công: {success_count}")
    print(f"❌ Thất bại: {fail_count}")
    print(f"{'='*60}")

# ==================== MAIN ====================
if __name__ == "__main__":
    print("🚀 FACEBOOK VIDEO CRAWLER (JDownloader Auto Mode)")
    print("=" * 60)
    
    # Tạo thư mục
    ensure_directories()
    
    # Kết nối JDownloader
    myjd, device = connect_to_jdownloader()
    if not device:
        print("❌ Không thể kết nối JDownloader")
        exit(1)
    
    print("\nChọn chế độ:")
    print("1. Crawl 1 video (nhập URL)")
    print("2. Crawl từ CSV (auto mode - giống YouTube)")
    print("0. Thoát")
    
    choice = input("\nLựa chọn (1/2/0): ").strip()
    
    if choice == "1":
        url = input("\nURL Facebook: ").strip()
        title = input("Tiêu đề (optional): ").strip() or f"FB_{int(time.time())}"
        
        if url:
            crawl_and_upload_single_facebook_video(myjd, device, url, title)
    
    elif choice == "2":
        csv_file = input("\nĐường dẫn CSV (ấn Enter để dùng mặc định): ").strip()
        
        if not csv_file:
            csv_file = os.path.join(os.path.dirname(__file__), '..', 'facebook_urls.csv')
        
        if os.path.exists(csv_file):
            crawl_batch_from_csv(myjd, device, csv_file)
        else:
            print(f"❌ File không tồn tại: {csv_file}")
            print("\n📝 Format CSV: url, title, status")
            print("VD:")
            print("  https://www.facebook.com/watch/?v=123, Video 1, not yet")
            print("  https://www.facebook.com/watch/?v=456, Video 2, not yet")
    
    elif choice == "0":
        print("👋 Tạm biệt!")
        sys.exit(0)
    
    else:
        print("❌ Lựa chọn không hợp lệ")
