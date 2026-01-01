import os
import uuid
import shutil
import logging
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from converter import FileConverter

# Configure logging to see errors in Vercel logs
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Vercel-friendly storage (/tmp is the only writable directory)
IS_CLOUD = os.environ.get('VERCEL') == '1'
TMP_BASE = Path("/tmp") if IS_CLOUD else Path(".")

UPLOAD_DIR = TMP_BASE / "uploads"
DOWNLOAD_DIR = TMP_BASE / "downloads"

# Ensure directories exist
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)

converter = FileConverter(str(UPLOAD_DIR), str(DOWNLOAD_DIR))

# In-memory task status storage (Note: will not persist across serverless instances)
tasks = {}

def conversion_task(task_id: str, input_filename: str, target_format: str):
    try:
        tasks[task_id]["status"] = "processing"
        output_path = converter.process_conversion(input_filename, target_format)
        tasks[task_id]["status"] = "completed"
        tasks[task_id]["output_file"] = str(output_path.name)
        logger.info(f"Task {task_id} completed successfully.")
    except Exception as e:
        logger.error(f"Task {task_id} failed: {e}")
        tasks[task_id]["status"] = "failed"
        tasks[task_id]["error"] = str(e)

@app.post("/api/upload")
async def upload_file(background_tasks: BackgroundTasks, file: UploadFile = File(...), target_format: str = "pdf"):
    # Vercel Free Tier Payload Limit is 4.5MB
    MAX_SIZE = 4 * 1024 * 1024 
    content = await file.read()
    
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Max 4MB on Vercel.")
    
    file_id = str(uuid.uuid4())
    input_filename = f"{file_id}_{file.filename}"
    input_path = UPLOAD_DIR / input_filename
    
    try:
        with open(input_path, "wb") as f:
            f.write(content)
    except Exception as e:
        logger.error(f"Failed to write file: {e}")
        raise HTTPException(status_code=500, detail="Internal server error during upload.")
    
    task_id = file_id
    tasks[task_id] = {
        "status": "pending",
        "input_file": input_filename,
        "target_format": target_format
    }
    
    background_tasks.add_task(conversion_task, task_id, input_filename, target_format)
    return {"task_id": task_id}

@app.get("/api/status/{task_id}")
async def get_status(task_id: str):
    if task_id not in tasks:
        # Fallback for serverless instance reset
        return {"status": "failed", "error": "Task context lost due to serverless restart. Please try again."}
    return tasks[task_id]

@app.get("/api/download/{task_id}")
async def download_file(task_id: str, background_tasks: BackgroundTasks):
    if task_id not in tasks or tasks[task_id]["status"] != "completed":
        raise HTTPException(status_code=404, detail="File not ready or task not found")
    
    output_filename = tasks[task_id]["output_file"]
    file_path = DOWNLOAD_DIR / output_filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")
    
    return FileResponse(path=file_path, filename=output_filename, media_type='application/octet-stream')

@app.get("/api/health")
async def health():
    return {"status": "ok", "platform": "vercel" if IS_CLOUD else "local"}

@app.get("/")
async def root():
    return {"message": "EasyConverter API is live!"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
