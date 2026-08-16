const els = {
  accountView: document.getElementById('account-view'),
  jobView: document.getElementById('job-view'),
  processingView: document.getElementById('processing-view'),
  errorView: document.getElementById('error-view'),
  resultView: document.getElementById('result-view'),
  accountForm: document.getElementById('account-form'),
  name: document.getElementById('name'),
  gmail: document.getElementById('gmail'),
  gmailError: document.getElementById('gmail-error'),
  accountSubmit: document.getElementById('account-submit'),
  jobDescription: document.getElementById('job-description'),
  resumeFile: document.getElementById('resume-file'),
  resumeDropzone: document.getElementById('resume-dropzone'),
  selectedFile: document.getElementById('selected-file'),
  resumeError: document.getElementById('resume-error'),
  submitJob: document.getElementById('submit-job'),
  changeAccount: document.getElementById('change-account'),
  processingMessage: document.getElementById('processing-message'),
  errorMessage: document.getElementById('error-message'),
  retryBtn: document.getElementById('retry-btn'),
  closeResult: document.getElementById('close-result'),
  uploadedPreview: document.getElementById('uploaded-preview'),
  generatedPreview: document.getElementById('generated-preview'),
  summaryContent: document.getElementById('summary-content'),
  downloadResume: document.getElementById('download-resume')
};

let selectedResume = null;
let latestGeneratedText = '';
let latestGeneratedDocxBase64 = null;
let latestFileName = 'ResumeRefresh_Personalized_Resume.docx';

function show(view) {
  [els.accountView, els.jobView, els.processingView, els.errorView, els.resultView]
    .forEach(node => node.classList.add('hidden'));
  view.classList.remove('hidden');
}

function isValidGmail(value) {
  return /^[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(value.trim());
}

function generateUserId() {
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  const base = Array.from(bytes, b => b.toString(36).padStart(2, '0')).join('').toUpperCase();
  return `USR-${base}`.slice(0, 12);
}

async function getStoredUser() {
  const data = await chrome.storage.local.get('resumeRefreshUser');
  return data.resumeRefreshUser || null;
}

async function saveStoredUser(user) {
  await chrome.storage.local.set({ resumeRefreshUser: user });
}

function backendConfigured() {
  return Boolean(APP_CONFIG.PROCESSING_API_URL && !APP_CONFIG.PROCESSING_API_URL.includes('PASTE_'));
}

async function postJSON(url, payload) {
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    });
  } catch (error) {
    throw new Error(`Could not reach ResumeRefresh backend at ${url}. Start the server and check the URL.`);
  }
  const raw = await response.text();
  let result;
  try { result = JSON.parse(raw); }
  catch {
    const snippet = raw.replace(/\s+/g, ' ').slice(0, 220);
    throw new Error(`Backend returned ${response.status} with non-JSON content: ${snippet || 'empty response'}`);
  }
  if (!response.ok || result.ok === false) {
    throw new Error(result.error || result.detail || `Server returned ${response.status}`);
  }
  return result;
}

async function registerUser(user) {
  if (APP_CONFIG.DEMO_MODE) return {ok:true, userId:user.id};
  if (!APP_CONFIG.APPS_SCRIPT_URL || APP_CONFIG.APPS_SCRIPT_URL.includes('PASTE_')) {
    throw new Error('Google Apps Script URL is not configured in config.js.');
  }
  return postJSON(APP_CONFIG.APPS_SCRIPT_URL, {action:'register_user', user});
}

function setProcessingMessage(message) { els.processingMessage.textContent = message; }
function clearErrors() {
  els.gmailError.textContent = '';
  els.resumeError.textContent = '';
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the resume file.'));
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      if (comma < 0) reject(new Error('Could not convert the resume file.'));
      else resolve(result.slice(comma + 1));
    };
    reader.readAsDataURL(file);
  });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[c]));
}

function formatResume(text) {
  const lines = String(text || '').split(/\r?\n/);
  return lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '<div style="height:7px"></div>';
    if (/^[A-Z][A-Z0-9 &/,+-]{2,40}$/.test(trimmed) || /^#{1,3}\s/.test(trimmed)) {
      return `<div class="resume-heading">${escapeHtml(trimmed.replace(/^#{1,3}\s*/, ''))}</div>`;
    }
    return escapeHtml(trimmed);
  }).join('\n');
}

function parseChanges(changes) {
  const items = String(changes || '').split(/\r?\n/).map(x => x.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
  if (!items.length) items.push('Resume content was tailored to the supplied job description.');
  return items.slice(0, 6).map(x => `<div class="summary-item">${escapeHtml(x)}</div>`).join('');
}

function showResult(result, originalText) {
  latestGeneratedText = result.personalizedResume || '';
  latestGeneratedDocxBase64 = result.docxBase64 || null;
  latestFileName = result.fileName || 'ResumeRefresh_Personalized_Resume.docx';

  els.uploadedPreview.innerHTML = formatResume(originalText);
  els.generatedPreview.innerHTML = formatResume(latestGeneratedText);
  els.summaryContent.innerHTML = parseChanges(result.changes);
  els.downloadResume.disabled = !latestGeneratedDocxBase64 && !latestGeneratedText;
  show(els.resultView);
}

function base64ToBlob(base64, mime) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i=0; i<binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], {type:mime});
}

async function downloadGeneratedResume() {
  if (latestGeneratedDocxBase64) {
    const blob = base64ToBlob(
      latestGeneratedDocxBase64,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    const url = URL.createObjectURL(blob);
    chrome.downloads.download({url, filename:latestFileName, saveAs:true}, () => {
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    });
    return;
  }
  const blob = new Blob([latestGeneratedText], {type:'text/plain;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({url, filename:latestFileName.replace(/\.docx$/i,'.txt'), saveAs:true}, () => {
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  });
}

async function init() {
  clearErrors();
  const user = await getStoredUser();
  if (user?.id && user?.gmail) show(els.jobView);
  else { show(els.accountView); els.name.focus(); }
}

els.accountForm.addEventListener('submit', async event => {
  event.preventDefault();
  clearErrors();
  const name = els.name.value.trim();
  const gmail = els.gmail.value.trim().toLowerCase();
  if (!name) { els.gmailError.textContent='Please enter your name.'; els.name.focus(); return; }
  if (!isValidGmail(gmail)) { els.gmailError.textContent='Enter a valid Gmail address ending in @gmail.com.'; els.gmail.focus(); return; }
  els.accountSubmit.disabled = true;
  try {
    const existing = await getStoredUser();
    const user = existing?.gmail === gmail && existing?.id
      ? {...existing, name}
      : {id:generateUserId(), name, gmail, createdAt:new Date().toISOString()};
    const result = await registerUser(user);
    if (result.userId) user.id = result.userId;
    await saveStoredUser(user);
    els.accountForm.reset();
    show(els.jobView);
  } catch (error) {
    els.errorMessage.textContent = error.message || 'Unable to create your account.';
    show(els.errorView);
  } finally { els.accountSubmit.disabled=false; }
});

els.resumeDropzone.addEventListener('click', () => els.resumeFile.click());
els.resumeDropzone.addEventListener('dragover', e => {e.preventDefault(); els.resumeDropzone.classList.add('dragover');});
els.resumeDropzone.addEventListener('dragleave', () => els.resumeDropzone.classList.remove('dragover'));
els.resumeDropzone.addEventListener('drop', e => {
  e.preventDefault(); els.resumeDropzone.classList.remove('dragover'); handleResume(e.dataTransfer.files?.[0]);
});
els.resumeFile.addEventListener('change', () => handleResume(els.resumeFile.files?.[0]));

function handleResume(file) {
  els.resumeError.textContent='';
  if (!file) return;
  const extensionAllowed=/\.pdf$/i.test(file.name);
  const typeAllowed=(file.type || '').toLowerCase()==='application/pdf';
  if (!extensionAllowed || (file.type && !typeAllowed)) {
    selectedResume=null;
    els.selectedFile.style.display='none';
    els.resumeError.textContent='PDF files only.';
    return;
  }
  if (file.size > APP_CONFIG.MAX_RESUME_BYTES) {
    selectedResume=null;
    els.selectedFile.style.display='none';
    els.resumeError.textContent='Resume must be 8 MB or smaller.';
    return;
  }
  selectedResume=file;
  els.selectedFile.textContent=file.name;
  els.selectedFile.style.display='block';
}

els.submitJob.addEventListener('click', async () => {
  clearErrors();
  const jobDescription=els.jobDescription.value.trim();
  if (jobDescription.length < 20) { els.resumeError.textContent='Paste a meaningful job description before submitting.'; els.jobDescription.focus(); return; }
  if (!selectedResume) { els.resumeError.textContent='Please upload your resume.'; return; }
  const user=await getStoredUser();
  if (!user?.id || !user?.gmail) { show(els.accountView); return; }

  els.submitJob.disabled=true; show(els.processingView); setProcessingMessage('Reading your resume...');
  try {
    const resumeBase64=await fileToBase64(selectedResume);
    setProcessingMessage('Converting your resume to text...');
    const result=await postJSON(APP_CONFIG.PROCESSING_API_URL, {
      userId:user.id, name:user.name, gmail:user.gmail,
      jobDescription,
      resume:{name:selectedResume.name, mimeType:'application/pdf', size:selectedResume.size, base64:resumeBase64}
    });
    setProcessingMessage('Personalizing your resume...');
    await new Promise(r=>setTimeout(r,250));
    showResult(result, result.originalResumeText || 'Resume text could not be displayed.');
  } catch(error) {
    els.errorMessage.textContent=error.message || 'Unable to process your resume.';
    show(els.errorView);
  } finally { els.submitJob.disabled=false; }
});

els.changeAccount.addEventListener('click', async () => {
  await chrome.storage.local.remove('resumeRefreshUser');
  selectedResume=null; els.resumeFile.value=''; els.selectedFile.style.display='none'; show(els.accountView); els.name.focus();
});
els.retryBtn.addEventListener('click', init);
els.closeResult.addEventListener('click', () => show(els.jobView));
els.downloadResume.addEventListener('click', downloadGeneratedResume);

init();
