// Global variables
let selectedFile = null;

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    const fileInput = document.getElementById('fileInput');
    const uploadArea = document.getElementById('uploadArea');
    const uploadBtn = document.getElementById('uploadBtn');
    const cancelBtn = document.getElementById('cancelBtn');

    // File input change
    fileInput.addEventListener('change', handleFileSelect);

    // Upload button click
    uploadBtn.addEventListener('click', uploadPhoto);

    // Cancel button click
    cancelBtn.addEventListener('click', resetForm);

    // Drag and drop
    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);
});

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
        selectedFile = file;
        showPreview(file);
    } else {
        alert('Please select a valid image file');
    }
}

function handleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.add('drag-over');
}

function handleDragLeave(event) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.remove('drag-over');
}

function handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.remove('drag-over');

    const file = event.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        selectedFile = file;
        showPreview(file);
    } else {
        alert('Please drop a valid image file');
    }
}

function showPreview(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('previewImage').src = e.target.result;
        document.getElementById('upload-section').querySelector('.upload-area').style.display = 'none';
        document.getElementById('preview-section').style.display = 'block';
    };
    reader.readAsDataURL(file);
}

async function uploadPhoto() {
    if (!selectedFile) {
        alert('Please select a photo first');
        return;
    }

    // Show loading
    document.getElementById('preview-section').style.display = 'none';
    document.getElementById('loading-section').style.display = 'block';

    const formData = new FormData();
    formData.append('photo', selectedFile);

    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            displayResult(result);
        } else {
            throw new Error(result.error || 'Upload failed');
        }
    } catch (error) {
        console.error('Upload error:', error);
        alert('Failed to upload photo: ' + error.message);
        resetForm();
    }
}

function displayResult(result) {
    // Hide loading
    document.getElementById('loading-section').style.display = 'none';

    // Show result
    document.getElementById('qrCode').src = result.qrCode;
    document.getElementById('photoLink').value = result.photoUrl;
    document.getElementById('viewPhotoLink').href = result.photoUrl;
    document.getElementById('result-section').style.display = 'block';
}

function copyLink() {
    const linkInput = document.getElementById('photoLink');
    linkInput.select();
    linkInput.setSelectionRange(0, 99999); // For mobile devices

    try {
        document.execCommand('copy');
        
        // Visual feedback
        const btn = event.target;
        const originalText = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => {
            btn.textContent = originalText;
        }, 2000);
    } catch (err) {
        console.error('Failed to copy:', err);
    }
}

function resetForm() {
    selectedFile = null;
    document.getElementById('fileInput').value = '';
    document.getElementById('preview-section').style.display = 'none';
    document.getElementById('loading-section').style.display = 'none';
    document.getElementById('result-section').style.display = 'none';
    document.getElementById('upload-section').querySelector('.upload-area').style.display = 'block';
}
