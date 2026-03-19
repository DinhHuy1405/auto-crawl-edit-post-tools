
import pandas as pd
from googleapiclient.discovery import build
import os
import re
import yt_dlp
import isodate
import glob
import datetime
import subprocess
import sys
import time
import json
from pathlib import Path
from myjdapi import Myjdapi
from dotenv import load_dotenv

# Load environment variables
env_path = os.path.join(os.path.dirname(__file__), '../../../.env')
if not os.path.exists(env_path):
    env_path = os.path.join(os.path.dirname(__file__), '../../.env')

load_dotenv(env_path)

# ==================== CONFIG LOADER ====================
def load_config():
    """Load shared config from root"""
    try:
        config_path = os.path.join(os.path.dirname(__file__), '../../config.json')
        with open(config_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"⚠️  Could not load config.json: {e}")
        print("   Using default values...")
        return {
            'paths': {
                'outputDir': '/Users/nguyendinhhuy/Documents/Edit Video/Thời Sự'
            },
            'crawler': {
                'useJDownloader': False,
                'downloadFormat': 'mp4'
            }
        }

CONFIG = load_config()
CRAWLER_CONFIG = CONFIG.get('crawler', {})
USE_JDOWNLOADER = CRAWLER_CONFIG.get('useJDownloader', False)
OUTPUT_DIR = CONFIG.get('paths', {}).get('outputDir', '/Users/nguyendinhhuy/Documents/Edit Video/Thời Sự')

def check_nodejs():
    """Kiểm tra xem Node.js đã cài chưa, nếu chưa thì cải đặt"""
    try:
        result = subprocess.run(['node', '--version'], capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            print(f"✓ Node.js đã cài: {result.stdout.strip()}")
            return True
    except:
        pass
    
    print("⚠️ Node.js chưa cài, cố gắng cài đặt...")
    try:
        # Thử cài Node.js với brew (macOS)
        subprocess.run(['brew', 'install', 'node'], check=True)
        print("✓ Node.js đã cài thành công")
        return True
    except:
        print("❌ Không thể cài Node.js. Hãy cài thủ công từ https://nodejs.org/")
        return False

# ==================== JDOWNLOADER FUNCTIONS ====================
def connect_to_jdownloader(email, password, device_name):
    """Kết nối tới JDownloader"""
    try:
        print("🔗 Đang kết nối tới JDownloader...")
        myjd = Myjdapi()
        myjd.connect(email, password)
        device = myjd.get_device(device_name)
        print("✅ Đã kết nối JDownloader")
        return myjd, device
    except Exception as e:
        print(f"❌ Lỗi kết nối JDownloader: {e}")
        return None, None

def send_youtube_video_to_jdownloader(device, video_url, download_dir):
    """
    Gửi YouTube video đến JDownloader để tải.
    LƯU Ý: JDownloader sẽ tự đổi packageName thành tên video thật,
    nên ta dùng folder-based polling thay vì package name matching.
    """
    try:
        print(f"📥 Gửi link: {video_url}")

        # Snapshot uuid hiện có trong linkgrabber trước khi gửi
        try:
            before_lg = {p['uuid'] for p in device.linkgrabber.query_packages([{'uuid': True}])}
        except Exception:
            before_lg = set()

        # Gửi link về JDownloader — autostart=False để ta tự move
        device.linkgrabber.add_links([{
            "autostart": False,
            "links": video_url,
            "extractPassword": "",
            "priority": "DEFAULT",
            "downloadPassword": "",
            "destinationFolder": download_dir
        }])

        # Chờ JDownloader parse link và tìm package mới (tối đa 30s)
        new_uuid = None
        for attempt in range(6):
            time.sleep(5)
            try:
                lg_packages = device.linkgrabber.query_packages([{'name': True, 'uuid': True}])
                new_pkgs = [p for p in lg_packages if p['uuid'] not in before_lg]
                if new_pkgs:
                    new_uuid = new_pkgs[0]['uuid']
                    new_name = new_pkgs[0].get('name', '?')
                    device.linkgrabber.move_to_downloadlist([], [new_uuid])
                    print(f"✅ Đã move sang download queue: {new_name}")
                    return new_uuid
                print(f"   ⏳ Chờ JDownloader parse link... ({(attempt+1)*5}s)")
            except Exception as e:
                print(f"   ⚠️ Lỗi query: {e}")

        print(f"⚠️ Không tìm thấy package mới trong linkgrabber sau 30s")
        return None

    except Exception as e:
        print(f"❌ Lỗi gửi link: {e}")
        return None

def wait_for_folder_downloads(download_folders, timeout=3600):
    """
    Chờ JDownloader download xong bằng cách poll file system.
    Mỗi folder cần có ít nhất 1 file .mp4 và không còn file .part/.crdownload/.tmp
    """
    VIDEO_EXTS = {'.mp4', '.mkv', '.mov', '.webm', '.avi'}
    TEMP_EXTS  = {'.part', '.crdownload', '.tmp', '.download', '.jd', '.jdtmp'}

    print(f"⏳ Chờ JDownloader download vào {len(download_folders)} folder(s)... (timeout: {timeout}s)")
    start_time = time.time()
    last_status = ""

    # Cho JDownloader 15s để bắt đầu
    time.sleep(15)

    while time.time() - start_time < timeout:
        done = []
        downloading = []
        empty = []

        for folder in download_folders:
            if not os.path.isdir(folder):
                empty.append(folder)
                continue
            all_files = list(Path(folder).rglob('*'))
            has_video = any(f.suffix.lower() in VIDEO_EXTS for f in all_files if f.is_file())
            has_temp  = any(f.suffix.lower() in TEMP_EXTS  for f in all_files if f.is_file())

            if has_video and not has_temp:
                done.append(folder)
            elif has_temp or (has_video and has_temp):
                downloading.append(folder)
            else:
                empty.append(folder)

        status = f"📥 Done: {len(done)} | Downloading: {len(downloading)} | Waiting: {len(empty)} / {len(download_folders)}"
        if status != last_status:
            print(status)
            last_status = status

        if len(done) >= len(download_folders):
            print("✅ Tất cả videos đã download xong!")
            return True

        # Không còn downloading và đã chờ > 60s → có thể JDL đang chờ start
        if not downloading and time.time() - start_time > 60:
            # Nếu vẫn có folder empty sau 3 phút → bỏ qua
            if time.time() - start_time > 180:
                print(f"⚠️ Timeout chờ folder — done={len(done)}/{len(download_folders)}, tiếp tục...")
                return len(done) > 0

        time.sleep(15)

    print(f"❌ Timeout {timeout}s — done={len(done)}/{len(download_folders)}")
    return False


def wait_for_downloads_complete(device, expected_packages=None, timeout=3600):
    """Legacy: chờ qua JDownloader API (ít tin cậy hơn folder-based)"""
    print(f"⏳ Chờ download hoàn tất qua API (timeout: {timeout}s)...")
    start_time = time.time()
    last_status = None

    time.sleep(10)

    while time.time() - start_time < timeout:
        try:
            downloads = device.downloads.query_packages()
            running  = [d for d in downloads if not d.get('finished', False)]
            finished = [d for d in downloads if d.get('finished', False)]

            status_str = f"📥 Running: {len(running)} | Finished: {len(finished)}"
            if status_str != last_status:
                print(status_str)
                last_status = status_str

            if not running:
                print("✅ Không còn task đang chạy")
                return True

            time.sleep(15)
        except Exception as e:
            print(f"⚠️ Lỗi: {e}")
            time.sleep(15)

    print("❌ Timeout")
    return False

def get_next_not_yet(csv_file):
    df = pd.read_csv(csv_file, sep=None, engine='python')
    next_row = df[df['status'] == 'not yet'].head(1)
    if not next_row.empty:
        idx = next_row.index[0]
        next_date = df.at[idx, 'date']
        # Nếu date dạng dd/mm/yyyy thì đổi sang yyyy-mm-dd
        try:
            next_date_std = datetime.datetime.strptime(next_date, "%d/%m/%Y").strftime("%Y-%m-%d")
        except Exception:
            next_date_std = next_date  # Nếu đã đúng format thì giữ nguyên
        # Đánh dấu done
        df.at[idx, 'status'] = 'done'
        df.to_csv(csv_file, index=False)
        return next_date_std
    else:
        return None


def get_channel_id(api_key, channel_input):
    if channel_input.startswith('UC') and len(channel_input) >= 24:
        return channel_input
    youtube = build("youtube", "v3", developerKey=api_key)
    request = youtube.search().list(
        part="snippet",
        q=channel_input,
        type="channel",
        maxResults=1
    )
    response = request.execute()
    if "items" in response and len(response["items"]) > 0:
        channel_id = response["items"][0]["snippet"]["channelId"]
        print(f"Đã tìm thấy channel ID cho '{channel_input}': {channel_id}")
        return channel_id
    else:
        print(f"Không tìm thấy channel id cho '{channel_input}'")
        return None

def get_duration_seconds(duration):
    try:
        return int(isodate.parse_duration(duration).total_seconds())
    except:
        return 0

def get_channel_videos_by_date_and_duration(api_key, channel_id, target_date, min_duration=180):
    youtube = build("youtube", "v3", developerKey=api_key)
    response = youtube.channels().list(part="contentDetails", id=channel_id).execute()
    if "items" not in response or not response["items"]:
        print(f"Channel ID không tồn tại hoặc bị lỗi: {channel_id}")
        return []
    uploads_playlist_id = response["items"][0]["contentDetails"]["relatedPlaylists"]["uploads"]
    videos = []
    next_page_token = None
    while True:
        request = youtube.playlistItems().list(
            part="snippet,contentDetails",
            playlistId=uploads_playlist_id,
            maxResults=50,
            pageToken=next_page_token,
        )
        response = request.execute()
        video_ids = []
        id2title = {}
        for item in response["items"]:
            video_date = item["contentDetails"]["videoPublishedAt"][:10]
            if video_date == target_date:
                vid = item["contentDetails"]["videoId"]
                video_ids.append(vid)
                id2title[vid] = item["snippet"]["title"]
        if video_ids:
            for i in range(0, len(video_ids), 50):
                ids_chunk = video_ids[i:i+50]
                video_req = youtube.videos().list(part="contentDetails,snippet", id=",".join(ids_chunk))
                video_resp = video_req.execute()
                for v in video_resp["items"]:
                    duration = get_duration_seconds(v["contentDetails"]["duration"])
                    if duration >= min_duration:
                        videos.append({
                            "video_id": v["id"],
                            "title": v["snippet"]["title"]
                        })
        next_page_token = response.get("nextPageToken")
        if not next_page_token:
            break
    return videos

def sanitize_filename(filename):
    name = re.sub(r'[<>:"/\\|?*\n\r\t]', '_', filename)
    name = name.strip()
    if not name:
        name = "video"
    return name

def clean_content(text: str) -> str:
    text = re.sub(r'<c>.*?</c>', '', text, flags=re.S)
    text = re.sub(r'<\d{2}:\d{2}:\d{2}\.\d+>', '', text)
    text = re.sub(r'\[\w+\]', '', text)
    text = re.sub(r'\d{2}:\d{2}:\d{2}\.\d+\s*-->\s*\d{2}:\d{2}:\d{2}\.\d+.*', '', text)
    text = re.sub(r'align:start position:0%', '', text)
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    return "\n".join(lines)

def process_sub_file(path: str, target_date: str) -> None:
    try:
        with open(path, "r", encoding="utf-8") as f:
            raw = f.read()
        cleaned_body = clean_content(raw)
        note_line = f"NOTE downloaded_date: {target_date}"
        new_content = f"{note_line}\n\n{cleaned_body}"
        with open(path, "w", encoding="utf-8") as f:
            f.write(new_content)
        print(f"✓ Đã clean: {path}")
    except Exception as e:
        print(f"✗ Lỗi với {path}: {e}")

def batch_clean(folder: str, target_date: str) -> None:
    subs = glob.glob(os.path.join(folder, "**", "*.vtt"), recursive=True) + \
           glob.glob(os.path.join(folder, "**", "*.srt"), recursive=True)
    if not subs:
        print("Không tìm thấy phụ đề nào.")
        return
    print(f"Đang xử lý {len(subs)} file phụ đề …")
    for fp in subs:
        process_sub_file(fp, target_date)

def rename_vtt_to_srt(folder_path, safe_title):
    vtt_files = glob.glob(os.path.join(folder_path, f"{safe_title}*.vtt"))
    for vtt_file in vtt_files:
        srt_file = vtt_file.rsplit('.', 1)[0] + ".srt"
        try:
            os.rename(vtt_file, srt_file)
            with open(srt_file, "r", encoding="utf-8") as f:
                content = f.read()
            clean = clean_content(content)
            with open(srt_file, "w", encoding="utf-8") as f:
                f.write(clean)
        except Exception as e:
            print(f"Không đổi tên hoặc clean được {vtt_file} sang .srt: {e}")

def download_video_and_transcript(url, title, video_id, date_folder, jd_device=None):
    """Download YouTube video qua JDownloader hoặc fallback yt-dlp"""
    safe_title = sanitize_filename(title)
    folder_name = f"{safe_title} [{video_id}]"
    save_path = os.path.join(date_folder, folder_name)
    os.makedirs(save_path, exist_ok=True)
    
    print(f"📥 Đang tải: {title}")
    
    success = False
    package_name = None
    
    # Strategy 1: Gửi qua JDownloader nếu có
    if not success and jd_device:
        try:
            print(f"  🔗 Gửi qua JDownloader...")
            package_name = send_youtube_video_to_jdownloader(jd_device, url, save_path)
            if package_name:
                success = True
                print(f"✅ Đã gửi JDownloader: {title}")
        except Exception as e:
            print(f"⚠️ Lỗi JDownloader: {str(e)[:100]}")
    
    # Strategy 2: Fallback dùng yt-dlp subprocess
    if not success:
        try:
            print(f"  🔄 Fallback yt-dlp...")
            cmd = [
                'yt-dlp',
                '--no-warnings',
                '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
                '--merge-output-format', 'mp4',
                '-o', f'{save_path}/{safe_title}.%(ext)s',
                '--no-part',
                '--no-continue',
                '--no-progress',
                '--retries', '3',
                '--socket-timeout', '15',
                '--fragment-retries', '5',
                # Tải subtitle tiếng Việt (auto-generated nếu không có manual)
                '--write-sub',
                '--write-auto-sub',
                '--sub-lang', 'vi',
                '--sub-format', 'vtt',
                ]
            cmd.append(url)
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
            if result.returncode == 0:
                print(f"✅ Đã tải xong (yt-dlp): {title}")
                success = True
            else:
                error_msg = result.stderr.split('\n')[0][:100]
                print(f"⚠️ Lỗi yt-dlp: {error_msg}")
        except Exception as e:
            print(f"⚠️ Lỗi fallback: {str(e)[:100]}")
    
    if not success:
        print(f"⏭️ Bỏ qua - không thể tải được")
        
    return package_name

def download_videos_of_channels(api_key, channels, target_date, min_duration=180, root_save_folder="", jd_device=None):
    date_folder = root_save_folder
    os.makedirs(date_folder, exist_ok=True)
    jd_packages = []
    jd_folders = []

    for channel_input in channels:
        channel_id = get_channel_id(api_key, channel_input)
        if not channel_id:
            continue
        videos = get_channel_videos_by_date_and_duration(api_key, channel_id, target_date, min_duration)
        if not videos:
            print(f"Không có video nào hợp lệ vào ngày {target_date} ở kênh '{channel_input}' ({channel_id})")
            continue
        for video in videos:
            url = f"https://www.youtube.com/watch?v={video['video_id']}"
            safe_title = sanitize_filename(video['title'])
            folder_name = f"{safe_title} [{video['video_id']}]"
            video_folder = os.path.join(date_folder, folder_name)
            pkg = download_video_and_transcript(url, video['title'], video['video_id'], date_folder, jd_device)
            if pkg:
                jd_packages.append(pkg)
                jd_folders.append(video_folder)

    return jd_packages, jd_folders

# ==================== SỬ DỤNG TỰ ĐỘNG ====================

# Cấu hình JDownloader
JD_EMAIL = os.getenv('JD_EMAIL')
JD_PASSWORD = os.getenv('JD_PASSWORD')
JD_DEVICE = os.getenv('JD_DEVICE')
# USE_JDOWNLOADER is now loaded from config.json above

# Load channels từ config (chỉ lấy những channel enabled=true)
_channels_cfg = CRAWLER_CONFIG.get('channels', [])
channels = [ch['id'] for ch in _channels_cfg if ch.get('enabled', True)]

if not channels:
    print("⚠️ Không có channel nào được enable trong config.json! Workflow có thể không chạy được.")
    # Fallback to BLV Anh Quân Discovery only if totally forced
    # channels = ["BLV Anh Quân Discovery"]

print(f"📺 Channels sẽ crawl ({len(channels)}): {', '.join(channels)}")

api_key = os.getenv('YOUTUBE_API_KEY')
root_save_folder = OUTPUT_DIR  # Use config value instead of hardcoded
# csv_file = "/Users/nguyendinhhuy/Desktop/Personal Project/auto-videos-genixtool/modules/crawl/date.csv"

# Kết nối JDownloader
print("=" * 50)
print("🎬 YOUTUBE VIDEO CRAWLER WITH JDOWNLOADER")
print("=" * 50)

myjd, jd_device = None, None
if USE_JDOWNLOADER:
    myjd, jd_device = connect_to_jdownloader(JD_EMAIL, JD_PASSWORD, JD_DEVICE)
else:
    print("ℹ️ USE_JDOWNLOADER=0 -> Dùng yt-dlp trực tiếp (đồng bộ, ổn định cho pipeline)")

if USE_JDOWNLOADER and not jd_device:
    print("❌ Không thể kết nối JDownloader, sẽ dùng fallback (yt-dlp)")

# target_date = get_next_not_yet(csv_file)    # dạng YYYY-MM-DD
target_date = (datetime.datetime.now() - datetime.timedelta(days=1)).strftime("%Y-%m-%d")

if target_date:
    folder_date = datetime.datetime.strptime(target_date, "%Y-%m-%d").strftime("%d%m%Y")
    main_save_folder = os.path.join(root_save_folder, folder_date)
    print("Đang chạy ngày:", target_date, " - folder:", main_save_folder)

    # 1. Download video via JDownloader
    submitted_packages, submitted_folders = download_videos_of_channels(
        api_key,
        channels,
        target_date,
        min_duration=180,
        root_save_folder=main_save_folder,
        jd_device=jd_device
    )

    # 2. Nếu dùng JDownloader, chờ download hoàn tất bằng cách poll folder
    if jd_device and submitted_folders:
        print(f"\n⏳ Chờ JDownloader hoàn tất {len(submitted_folders)} videos...")
        wait_for_folder_downloads(submitted_folders, timeout=3600)
    elif jd_device:
        print("\n✅ Không có video mới nào được gửi tới JDownloader.")
    
    # 3. Clean toàn bộ phụ đề sau khi tải xong
    batch_clean(main_save_folder, target_date)

else:
    print("Không còn ngày 'not yet' để chạy.")
