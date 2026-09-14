/**
 * 萬能科技大學 - 創意發想與實踐 ✕ Antigravity ✕ AI Agent 互動教學平台
 * 授課教師：邱俊維 博士 ｜ 開課班級：企管四系1甲 ｜ 地點：G104 多媒體教室
 */

// 全域狀態管理
let curriculumData = null;
let questionsData = [];
let agentTemplates = [];
let isOfflineMode = false;
let systemInfo = {
  local_ip: '127.0.0.1',
  port: 5000,
  classroom_url: window.location.origin
};

// 使用者狀態
let currentUser = {
  studentId: localStorage.getItem('vnu_ideation_student_id') || '',
  studentName: localStorage.getItem('vnu_ideation_student_name') || '',
  studentGroup: localStorage.getItem('vnu_ideation_student_group') || '1',
  teamName: localStorage.getItem('vnu_ideation_team_name') || '企管四系1甲 第 1 組',
  get name() { return this.studentName; },
  set name(val) { this.studentName = val; },
  get team() { return this.teamName; },
  set team(val) { this.teamName = val; },
  get group() { return this.studentGroup; },
  set group(val) { this.studentGroup = val; }
};
let userProfile = currentUser;

// 學生作品上傳與展示狀態
let studentWorksData = [];
let currentWorksFilter = 'all';

// 錯題筆記本與解鎖徽章
let wrongQuestionsSet = new Set(JSON.parse(localStorage.getItem('vnu_ideation_wrong_q') || '[]'));
let unlockedBadges = new Set(JSON.parse(localStorage.getItem('vnu_ideation_badges') || '["badge_first_login"]'));

// 測驗狀態
let activeQuiz = {
  questions: [],
  currentIndex: 0,
  userAnswers: {}, // {qid: optIndex}
  timerSeconds: 0,
  timerInterval: null,
  examModeTitle: '隨堂快測'
};

// 大轉盤狀態
let wheelNames = ['第 1 組', '第 2 組', '第 3 組', '第 4 組', '第 5 組', '第 6 組', '第 7 組', '第 8 組'];
let wheelAngle = 0;
let isSpinning = false;

// 課堂討論計時器狀態
let workshopTimer = {
  duration: 480,
  remaining: 480,
  interval: null,
  isRunning: false,
  presetTitle: 'Crazy 8s 瘋狂八分鐘'
};

// 當前選取的 Agent
let currentAgentIndex = 0;

/* ==========================================================================
   0. 自建零依賴 Modal 與視窗控制系統 (完全相容離線與本地 file:/// 模式)
   ========================================================================== */
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.add('show');
  modal.style.display = 'block';
  document.body.classList.add('modal-open');
  document.body.style.overflow = 'hidden';
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.remove('show');
  modal.style.display = 'none';
  const anyOpen = document.querySelectorAll('.modal.show').length > 0;
  if (!anyOpen) {
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
  }
}

// 全域監聽背景點擊關閉與 ESC 鍵關閉
window.addEventListener('click', (e) => {
  if (e.target && e.target.classList.contains('modal')) {
    closeModal(e.target.id);
  }
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal.show').forEach(m => closeModal(m.id));
  }
});

/* ==========================================================================
   0.1 自建零依賴 Tab 標籤切換系統 (相容任意網路環境與單機離線)
   ========================================================================== */
function switchTab(tabId) {
  // 1. 切換標籤頁按鈕樣式
  document.querySelectorAll('#mainTab .nav-link').forEach(btn => {
    btn.classList.remove('active');
  });
  const targetBtn = document.getElementById(`${tabId}-btn`);
  if (targetBtn) targetBtn.classList.add('active');

  // 2. 切換各分頁內容區
  document.querySelectorAll('#mainTabContent .tab-pane').forEach(pane => {
    pane.classList.remove('active', 'show');
    pane.style.display = 'none';
  });
  const targetPane = document.getElementById(tabId);
  if (targetPane) {
    targetPane.classList.add('active', 'show');
    targetPane.style.display = 'block';
  }

  // 3. 分頁專屬重繪或觸發
  if (tabId === 'tab-classroom') {
    setTimeout(drawWheelCanvas, 60);
  } else if (tabId === 'tab-portfolio') {
    updatePortfolioUserInfo();
    renderStudentWorks();
  } else if (tabId === 'tab-quiz') {
    renderRadarChart();
    renderWrongQuestions();
  } else if (tabId === 'tab-presentation') {
    const iframe = document.getElementById('presentation-iframe');
    if (iframe) {
      iframe.src = getPresentationUrl();
    }
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function getPresentationUrl() {
  const isLocal = (window.location.protocol === 'file:' || window.IS_STANDALONE_OFFLINE || isOfflineMode);
  return isLocal ? 'Full_Screen_Presentation.html' : '/presentation';
}

function updateAllPresentationLinks() {
  const url = getPresentationUrl();
  document.querySelectorAll('.presentation-link').forEach(el => {
    el.href = url;
  });
}

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  if (window.location.protocol === 'file:' || window.IS_STANDALONE_OFFLINE) {
    isOfflineMode = true;
  }
  
  // 0. 優先初始化 Firebase 雲端服務與 Google 驗證監聽
  try { initFirebase(); } catch(e) { console.warn('initFirebase error', e); }

  // 1. 優先立即載入系統資料與首頁核心資訊 (教師檔案、評分規準、教學地圖)
  try { await loadSystemData(); } catch(e) { console.warn('loadSystemData error', e); }
  try { renderCurriculum(); } catch(e) { console.warn('renderCurriculum error', e); }
  try { renderHeaderInfo(); } catch(e) { console.warn('renderHeaderInfo error', e); }
  try { initUserModal(); } catch(e) { console.warn('initUserModal error', e); }
  try { updatePortfolioUserInfo(); } catch(e) { console.warn('updatePortfolioUserInfo error', e); }
  
  // 2. 載入各模組與學生作品
  try { renderWorksheets(); } catch(e) { console.warn('renderWorksheets error', e); }
  try { renderAgentTemplates(); } catch(e) { console.warn('renderAgentTemplates error', e); }
  try { await initStudentWorks(); } catch(e) { console.warn('initStudentWorks error', e); }
  try { renderStudentWorks(); } catch(e) { console.warn('renderStudentWorks error', e); }
  try { initClassroomTools(); } catch(e) { console.warn('initClassroomTools error', e); }
  try { initQuizSystem(); } catch(e) { console.warn('initQuizSystem error', e); }
  try { renderBadges(); } catch(e) { console.warn('renderBadges error', e); }
  try { renderWrongQuestions(); } catch(e) { console.warn('renderWrongQuestions error', e); }
  try { renderRadarChart(); } catch(e) { console.warn('renderRadarChart error', e); }
  try { updateAllPresentationLinks(); } catch(e) { console.warn('updateAllPresentationLinks error', e); }
  
  // 3. 預設切換至第一週導論頁
  try { switchTab('tab-intro'); } catch(e) {}
});


/* ==========================================================================
   0. Firebase 初始化與 Google 登入驗證
   ========================================================================== */
const firebaseConfig = {
  apiKey: "AIzaSyCSQ1SfZ67UYZ_4F4JazSC5QptA1ZY1UdU",
  authDomain: "vnu-creative-11501.firebaseapp.com",
  projectId: "vnu-creative-11501",
  storageBucket: "vnu-creative-11501.firebasestorage.app",
  messagingSenderId: "192871776919",
  appId: "1:192871776919:web:47aea414ec5af5774b5fd2",
  measurementId: "G-X90WGR0GV2"
};

let firebaseApp = null;
let firebaseAuth = null;
let firestoreDb = null;
let isFirebaseAvailable = false;
let currentFirebaseUser = null;
let isTeacherUser = false;

function initFirebase() {
  if (isFirebaseAvailable && firebaseAuth) return;
  if (typeof firebase !== 'undefined' && firebase.initializeApp) {
    try {
      if (!firebase.apps || !firebase.apps.length) {
        firebaseApp = firebase.initializeApp(firebaseConfig);
      } else {
        firebaseApp = firebase.app();
      }
      firebaseAuth = firebase.auth();
      firestoreDb = firebase.firestore();
      isFirebaseAvailable = true;
      console.log('✅ Firebase 初始化成功 (專案: vnu-creative-11501)');

      // 監聽 Redirect 登入結果 (避免彈跳視窗被攔截時仍可登入)
      if (firebaseAuth.getRedirectResult) {
        firebaseAuth.getRedirectResult().then((result) => {
          if (result && result.user) {
            console.log('Google 重定向登入成功:', result.user.email);
          }
        }).catch((err) => {
          console.warn('Redirect sign-in notice:', err);
        });
      }

      // 監聽 Auth 登入狀態
      firebaseAuth.onAuthStateChanged(async (user) => {
        currentFirebaseUser = user;
        if (user) {
          console.log('👤 Google 使用者已登入:', user.email, user.uid);
          
          // 判定授課教師身分 (邱俊維 博士)
          const userEmail = (user.email || (user.providerData && user.providerData[0] && user.providerData[0].email) || '').toLowerCase().trim();
          const teacherEmails = ['kevin87332000', 'kevin87332000@gmail.com', 'jimchiu', 'jimchiu@mail.vnu.edu.tw', 'vnuemba@gmail.com', 'h12s12bs', 'h12s12bs@gmail.com'];
          isTeacherUser = teacherEmails.some(em => userEmail.includes(em.toLowerCase()));
          console.log('👑 教師身分判定結果:', isTeacherUser ? '是授課教師 (邱俊維 博士)' : '一般學生/訪客');
          
          await loadUserProfileFromFirestore(user);
          renderHeaderInfo();
          updatePortfolioUserInfo();
          listenToFirestoreWorks();
        } else {
          console.log('👤 使用者已登出 (訪客模式)');
          isTeacherUser = false;
          currentUser.isGoogleAuth = false;
          renderHeaderInfo();
          updatePortfolioUserInfo();
        }
      });
    } catch (e) {
      console.warn('⚠️ Firebase 初始化警告:', e);
      isFirebaseAvailable = false;
    }
  } else {
    console.log('離線或未載入 Firebase SDK，使用本機 localStorage 模式');
  }
}

// 立即嘗試一次初始化 (若腳本於 head 之後已載入 SDK)
try { initFirebase(); } catch(e) {}

function loginWithGoogle() {
  console.log('🔘 Google 登入按鈕被點擊');
  if (!isFirebaseAvailable || !firebaseAuth) {
    if (typeof firebase !== 'undefined' && firebase.initializeApp) {
      initFirebase();
    }
  }

  if (!isFirebaseAvailable || !firebaseAuth) {
    alert('Firebase 雲端驗證服務載入中或處於離線狀態，系統已為您直接開啟學籍登記視窗！');
    openModal('userProfileModal');
    return;
  }

  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    firebaseAuth.signInWithPopup(provider).then((result) => {
      console.log('Google 登入成功:', result.user.email);
    }).catch((error) => {
      console.error('Google 登入失敗:', error);
      if (error.code === 'auth/popup-closed-by-user') return;
      if (error.code === 'auth/popup-blocked') {
        const tryRedirect = confirm('⚠️ 您的瀏覽器封鎖了 Google 登入彈跳視窗！\n\n是否改用直接頁面跳轉 (Redirect) 方式進行 Google 登入？');
        if (tryRedirect) {
          firebaseAuth.signInWithRedirect(provider);
        }
        return;
      }
      if (error.code === 'auth/unauthorized-domain') {
        alert(`⚠️ Firebase 網域尚未授權提示：\n\n目前網站網域為：【${window.location.hostname}】\n\n請至 Firebase Console (專案：vnu-creative-11501)\n-> Authentication\n-> Settings (設定)\n-> Authorized domains (已授權的網域)\n將【${window.location.hostname}】加入授權網域清單即可順利登入！`);
        return;
      }
      alert('Google 登入提示：' + (error.message || error));
    });
  } catch (err) {
    console.error('啟動登入程序錯誤:', err);
    alert('啟動登入視窗失敗：' + err.message);
  }
}

function logoutUser() {
  if (firebaseAuth) {
    firebaseAuth.signOut().then(() => {
      alert('您已安全登出 Google 帳號。');
    });
  } else {
    alert('已清除登入狀態。');
  }
}

async function loadUserProfileFromFirestore(user) {
  if (!firestoreDb) return;
  try {
    if (isTeacherUser) {
      currentUser.studentId = 'TEACHER';
      currentUser.studentName = '邱俊維 博士';
      currentUser.email = user.email || '';
      currentUser.photoURL = user.photoURL || '';
      currentUser.isGoogleAuth = true;
      userProfile = {
        studentId: 'TEACHER',
        name: '邱俊維 博士',
        team: '授課教師',
        email: user.email || ''
      };
      localStorage.setItem('vnu_student_id', 'TEACHER');
      localStorage.setItem('vnu_student_name', '邱俊維 博士');
      localStorage.setItem('vnu_user_profile', JSON.stringify(userProfile));
      
      try {
        firestoreDb.collection('users').doc(user.uid).set({
          uid: user.uid,
          email: user.email || '',
          studentId: 'TEACHER',
          studentName: '邱俊維 博士',
          className: '授課教師',
          photoURL: user.photoURL || '',
          role: 'teacher',
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true }).catch(() => {});
      } catch(e) {}
      return;
    }

    const doc = await firestoreDb.collection('users').doc(user.uid).get();
    if (doc.exists) {
      const data = doc.data();
      currentUser.studentId = data.studentId || '';
      currentUser.studentName = data.studentName || user.displayName || '同學';
      currentUser.email = user.email || '';
      currentUser.photoURL = user.photoURL || '';
      currentUser.isGoogleAuth = true;
      userProfile = {
        studentId: currentUser.studentId,
        name: currentUser.studentName,
        team: '企管四系1甲',
        email: currentUser.email
      };
      localStorage.setItem('vnu_student_id', currentUser.studentId);
      localStorage.setItem('vnu_student_name', currentUser.studentName);
      localStorage.setItem('vnu_user_profile', JSON.stringify(userProfile));
      localStorage.setItem('vnu_ideation_student_id', currentUser.studentId);
      localStorage.setItem('vnu_ideation_student_name', currentUser.studentName);
    } else {
      // 首次學生登入 -> 自動彈窗請同學綁定學號與姓名
      currentUser.studentId = '';
      currentUser.studentName = user.displayName || '';
      currentUser.email = user.email || '';
      currentUser.photoURL = user.photoURL || '';
      currentUser.isGoogleAuth = true;
      initUserModal();
      openModal('userProfileModal');
    }
  } catch (e) {
    console.warn('載入 Firestore 使用者學籍失敗:', e);
  }
}

let unsubscribeFirestoreWorks = null;
function listenToFirestoreWorks() {
  if (!firestoreDb) return;
  if (unsubscribeFirestoreWorks) unsubscribeFirestoreWorks();

  try {
    unsubscribeFirestoreWorks = firestoreDb.collection('works')
      .onSnapshot((snapshot) => {
        const firestoreWorks = [];
        snapshot.forEach(doc => {
          firestoreWorks.push(doc.data());
        });
        if (firestoreWorks.length > 0) {
          // 依提交時間排序
          firestoreWorks.sort((a, b) => (b.submitted_at || '').localeCompare(a.submitted_at || ''));
          
          const existingIds = new Set(firestoreWorks.map(w => w.id));
          const nonDuplicateSamples = (window.OFFLINE_WORKS || []).filter(w => !existingIds.has(w.id));
          studentWorksData = [...firestoreWorks, ...nonDuplicateSamples];
        }
        renderStudentWorks();
      }, (err) => {
        console.warn('Firestore works listener notice:', err);
      });
  } catch (e) {
    console.warn('建立 Firestore 作品即時監聽失敗:', e);
  }
}

/* ==========================================================================
   1. 資料載入與離線容錯機制
   ========================================================================== */
async function loadSystemData() {
  if (window.IS_STANDALONE_OFFLINE) {
    isOfflineMode = true;
    curriculumData = window.OFFLINE_CURRICULUM || null;
    questionsData = window.OFFLINE_QUESTIONS || [];
    agentTemplates = window.OFFLINE_TEMPLATES || [];
    return;
  }

  try {
    const res = await fetch('/api/system_info');
    if (res.ok) {
      systemInfo = await res.json();
    }
  } catch (e) {
    console.warn('Backend API unavailable, using offline defaults.');
    isOfflineMode = true;
  }

  // 1. 課綱資料
  try {
    const res = await fetch('/api/curriculum');
    if (res.ok) curriculumData = await res.json();
  } catch (e) {
    curriculumData = window.OFFLINE_CURRICULUM || null;
  }
  if (!curriculumData && window.OFFLINE_CURRICULUM) {
    curriculumData = window.OFFLINE_CURRICULUM;
  }

  // 2. 題庫資料
  try {
    const res = await fetch('/api/questions?count=200&shuffle=false');
    if (res.ok) {
      const data = await res.json();
      questionsData = data.questions || [];
    }
  } catch (e) {
    questionsData = window.OFFLINE_QUESTIONS || [];
  }
  if ((!questionsData || questionsData.length === 0) && window.OFFLINE_QUESTIONS) {
    questionsData = window.OFFLINE_QUESTIONS;
  }

  // 3. Agent 範本
  try {
    const res = await fetch('/api/agent_templates');
    if (res.ok) agentTemplates = await res.json();
  } catch (e) {
    agentTemplates = window.OFFLINE_TEMPLATES || [];
  }
  if ((!agentTemplates || agentTemplates.length === 0) && window.OFFLINE_TEMPLATES) {
    agentTemplates = window.OFFLINE_TEMPLATES;
  }
}

function renderHeaderInfo() {
  const urlDisplay = document.getElementById('classroom-url-display');
  const urlText = document.getElementById('classroom-url-text');
  const displayUrl = systemInfo.classroom_url || window.location.origin;

  if (urlDisplay) urlDisplay.textContent = displayUrl;
  if (urlText) urlText.textContent = displayUrl;

  const btnGoogleLogin = document.getElementById('btn-google-login');
  const userAuthBox = document.getElementById('user-auth-box');
  const studentBadge = document.getElementById('student-info-badge');
  const userAvatarImg = document.getElementById('user-avatar-img');
  const userAvatarIcon = document.getElementById('user-avatar-icon');
  const dropdownEmail = document.getElementById('dropdown-user-email');
  const teacherMenuItem = document.getElementById('teacher-export-menu-item');
  const btnTeacherExportCsv = document.getElementById('btn-teacher-export-csv');

  if (currentFirebaseUser) {
    const userEmail = (currentFirebaseUser.email || (currentFirebaseUser.providerData && currentFirebaseUser.providerData[0] && currentFirebaseUser.providerData[0].email) || '').toLowerCase().trim();
    const teacherEmails = ['kevin87332000', 'kevin87332000@gmail.com', 'jimchiu', 'jimchiu@mail.vnu.edu.tw', 'vnuemba@gmail.com', 'h12s12bs', 'h12s12bs@gmail.com'];
    if (teacherEmails.some(em => userEmail.includes(em.toLowerCase()))) {
      isTeacherUser = true;
      currentUser.studentName = '邱俊維 博士';
      currentUser.studentId = 'TEACHER';
      currentUser.teamName = '授課教師';
    }

    if (btnGoogleLogin) btnGoogleLogin.style.display = 'none';
    if (userAuthBox) userAuthBox.style.display = 'block';

    if (currentFirebaseUser.photoURL && userAvatarImg) {
      userAvatarImg.src = currentFirebaseUser.photoURL;
      userAvatarImg.style.display = 'inline-block';
      if (userAvatarIcon) userAvatarIcon.style.display = 'none';
    } else {
      if (userAvatarImg) userAvatarImg.style.display = 'none';
      if (userAvatarIcon) userAvatarIcon.style.display = 'inline-block';
    }

    if (dropdownEmail) {
      dropdownEmail.textContent = isTeacherUser ? `👑 授課教師 (${currentFirebaseUser.email})` : currentFirebaseUser.email;
    }

    if (studentBadge) {
      if (isTeacherUser) {
        studentBadge.innerHTML = `<span class="badge bg-warning text-dark me-1">教師</span>邱俊維 博士`;
      } else {
        studentBadge.textContent = currentUser.studentId 
          ? `企管四系1甲 ${currentUser.studentName}` 
          : `${currentUser.studentName || '同學 (請登記學號)'}`;
      }
    }

    if (teacherMenuItem) teacherMenuItem.style.display = isTeacherUser ? 'block' : 'none';
    if (btnTeacherExportCsv) btnTeacherExportCsv.style.display = isTeacherUser ? 'inline-block' : 'none';
  } else {
    if (btnGoogleLogin) btnGoogleLogin.style.display = 'inline-flex';
    if (userAuthBox) userAuthBox.style.display = 'none';
    if (studentBadge) {
      studentBadge.textContent = currentUser.studentId 
        ? `企管四系1甲 ${currentUser.studentName}` 
        : '學號登記';
    }
    if (btnTeacherExportCsv) btnTeacherExportCsv.style.display = 'none';
  }

  renderClassroomQRCode(displayUrl);
}

function renderClassroomQRCode(url) {
  const qrBox = document.getElementById('qrcode-box');
  if (!qrBox) return;
  qrBox.innerHTML = '';

  if (typeof QRCode !== 'undefined') {
    try {
      new QRCode(qrBox, {
        text: url,
        width: 170,
        height: 170,
        colorDark: "#0B1120",
        colorLight: "#FFFFFF",
        correctLevel: QRCode.CorrectLevel.M
      });
      return;
    } catch (e) {
      console.warn('QRCode library error, using SVG fallback', e);
    }
  }

  // Pure SVG/Canvas Fallback when offline without CDN
  qrBox.innerHTML = `
    <div style="width: 170px; height: 170px; background: #0B1120; border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: white; padding: 10px; text-align: center;">
      <i class="fas fa-qrcode fs-1 text-warning mb-2"></i>
      <span class="small fw-bold text-light" style="font-size: 0.75rem;">請手動輸入投影網址</span>
      <code class="text-warning small mt-1" style="font-size: 0.7rem; word-break: break-all;">${url}</code>
    </div>
  `;
}

function copyClassroomUrl() {
  const url = systemInfo.classroom_url || window.location.origin;
  navigator.clipboard.writeText(url).then(() => {
    alert('已複製教室連線網址：\n' + url + '\n供學生手機與筆電連線互動！');
  }).catch(() => {
    alert('請手動複製網址：' + url);
  });
}

/* ==========================================================================
   2. 使用者學號與成就管理
   ========================================================================== */
function initUserModal() {
  const inputId = document.getElementById('input-student-id');
  const inputName = document.getElementById('input-student-name');
  if (inputId) inputId.value = currentUser.studentId || '';
  if (inputName) inputName.value = currentUser.studentName || '';

  const googleBox = document.getElementById('google-account-info-box');
  const googleEmail = document.getElementById('input-google-email');
  if (googleBox && googleEmail) {
    if (currentFirebaseUser && currentFirebaseUser.email) {
      googleBox.style.display = 'block';
      googleEmail.value = currentFirebaseUser.email;
    } else {
      googleBox.style.display = 'none';
    }
  }
}

function saveUserProfile() {
  const inputId = document.getElementById('input-student-id').value.trim();
  const inputName = document.getElementById('input-student-name').value.trim();
  if (!inputId || !inputName) {
    alert('請輸入學號與姓名以記錄個人學習歷程！');
    return;
  }
  currentUser.studentId = inputId;
  currentUser.studentName = inputName;
  delete currentUser.studentGroup;
  currentUser.teamName = '企管四系1甲';

  userProfile = {
    studentId: inputId,
    name: inputName,
    team: '企管四系1甲',
    email: currentFirebaseUser ? currentFirebaseUser.email : ''
  };

  localStorage.setItem('vnu_student_id', inputId);
  localStorage.setItem('vnu_student_name', inputName);
  localStorage.setItem('vnu_user_profile', JSON.stringify(userProfile));
  localStorage.setItem('vnu_ideation_student_id', inputId);
  localStorage.setItem('vnu_ideation_student_name', inputName);
  localStorage.setItem('vnu_ideation_team_name', currentUser.teamName);

  // 若使用 Google 登入，即時同步至雲端 Firestore
  if (currentFirebaseUser && firestoreDb) {
    try {
      firestoreDb.collection('users').doc(currentFirebaseUser.uid).set({
        uid: currentFirebaseUser.uid,
        email: currentFirebaseUser.email || '',
        studentId: inputId,
        studentName: inputName,
        className: '企管四系1甲',
        photoURL: currentFirebaseUser.photoURL || '',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true }).then(() => {
        console.log('✅ 學籍資料已同步儲存至 Firebase 雲端');
      }).catch(err => console.warn('Firestore sync user error:', err));
    } catch (e) {
      console.warn('Sync profile to Firestore failed:', e);
    }
  }

  renderHeaderInfo();
  updatePortfolioUserInfo();
  renderStudentWorks();
  unlockBadge('badge_profile_set');
  alert(`歡迎【企管四系1甲】${currentUser.studentName} 同學！學籍已成功綁定。`);
  closeModal('userProfileModal');
}

function unlockBadge(badgeId) {
  if (!unlockedBadges.has(badgeId)) {
    unlockedBadges.add(badgeId);
    localStorage.setItem('vnu_ideation_badges', JSON.stringify([...unlockedBadges]));
    renderBadges();
  }
}

function renderBadges() {
  const container = document.getElementById('badges-container');
  const countSpan = document.getElementById('unlocked-badges-count');
  if (!container) return;

  const allBadges = [
    { id: 'badge_first_login', name: '破冰啟航', icon: 'fa-compass', desc: '首次啟動創意發想與微型創業平台' },
    { id: 'badge_profile_set', name: '正式名冊', icon: 'fa-id-card', desc: '完成企管四系1甲學號與姓名登記' },
    { id: 'badge_idea_deck', name: '靈感捕手', icon: 'fa-lightbulb', desc: '課堂操作靈感抽卡機完成一次發想' },
    { id: 'badge_agent_react', name: 'AI 指揮官', icon: 'fa-robot', desc: '完成一次微型創業 Agent 推理模擬' },
    { id: 'badge_weekly_quiz', name: '隨堂精兵', icon: 'fa-check-double', desc: '完成一次手機隨堂 5 題觀念快測' },
    { id: 'badge_score_90', name: '創業先鋒', icon: 'fa-trophy', desc: '在全真模擬測驗中取得 90 分以上高分' },
    { id: 'badge_proposal_draft', name: '企劃大師', icon: 'fa-file-signature', desc: '一鍵產出完整一頁式微型創業企劃書' },
    { id: 'badge_wrong_review', name: '精益求精', icon: 'fa-book-open', desc: '複習並清空個人錯題筆記本' }
  ];

  if (countSpan) {
    countSpan.textContent = `已解鎖 ${unlockedBadges.size} / ${allBadges.length}`;
  }

  container.innerHTML = allBadges.map(b => {
    const isUnlocked = unlockedBadges.has(b.id);
    return `
      <div class="col-6 col-md-3 mb-3">
        <div class="badge-card ${isUnlocked ? 'unlocked' : ''}">
          <i class="fas ${b.icon} badge-icon"></i>
          <h6 class="fw-bold mb-1 text-dark">${b.name}</h6>
          <p class="small text-muted mb-0">${b.desc}</p>
          <span class="badge ${isUnlocked ? 'bg-warning text-dark' : 'bg-light text-secondary'} mt-2">
            ${isUnlocked ? '已解鎖' : '未解鎖'}
          </span>
        </div>
      </div>
    `;
  }).join('');
}

/* ==========================================================================
   3. 第一週導論、評分標準與 18 週教學地圖
   ========================================================================== */
function renderCurriculum(filterPhase = 'all') {
  if (!curriculumData && window.OFFLINE_CURRICULUM) {
    curriculumData = window.OFFLINE_CURRICULUM;
  }
  if (!curriculumData) {
    curriculumData = {
      course_info: {
        name: "創意發想與實踐",
        code: "C0910009",
        semester: "11501 學期",
        class_name: "企管四系1甲",
        classroom: "G104 多媒體教室",
        time_slot: "每週一 第 6、7 節 (13:00 ~ 14:45)",
        instructor: {
          name: "邱俊維 博士 (Dr. Chun-Wei Chiu)",
          title: "萬能科技大學 企業管理系 專案助理教授",
          email: "jimchiu@mail.vnu.edu.tw",
          office: "育英樓 J801-1 研究室",
          office_hours: "每週一 15:00 ~ 16:00、週四 14:00 ~ 16:00 (敬請事先預約)",
          philosophy: "創意思維不是玄學，而是『痛點洞察 ✕ 結構化表達 ✕ 快速原型驗證』的科學方法。在 Vibe Coding 與 Agentic AI 時代，你不需要是工程師，只要能清晰表達邏輯、指揮 AI 特工協同，就能將微型創業構想轉化為全球可瀏覽的數位作品！",
          welcome_message: "歡迎企管大一新鮮人！帶著你的靈感與手機，課堂跟著老師即時演示互動，回家用 Antigravity 完成你的第一個微型創業展示網站！"
        }
      }
    };
  }

  // 1. 教師檔案
  const info = curriculumData.course_info;
  const teacherEl = document.getElementById('teacher-profile-box');
  if (teacherEl && info) {
    teacherEl.innerHTML = `
      <div class="d-flex align-items-center mb-3">
        <div class="teacher-avatar-box me-3">
          <i class="fas fa-chalkboard-teacher"></i>
        </div>
        <div>
          <h4 class="fw-bold mb-0 text-dark">${info.instructor.name}</h4>
          <p class="text-primary fw-semibold mb-1">${info.instructor.title}</p>
          <div class="d-flex flex-wrap gap-2">
            <span class="info-badge"><i class="fas fa-envelope me-1 text-primary"></i>${info.instructor.email}</span>
            <span class="info-badge"><i class="fas fa-building me-1 text-info"></i>${info.instructor.office}</span>
            <span class="info-badge"><i class="fas fa-clock me-1 text-warning"></i>Office Hour: ${info.instructor.office_hours}</span>
          </div>
        </div>
      </div>
      <div class="row g-2 mb-3">
        <div class="col-md-6">
          <div class="p-2 bg-light rounded-2 border-start border-3 border-primary small">
            <strong class="text-dark"><i class="fas fa-chart-line text-primary me-1"></i>校務數據分析與產學歷練：</strong>
            <ul class="mb-0 ps-3 text-secondary" style="font-size: 0.85rem;">
              <li>長庚大學校務研究中心分析師（校務數據統計分析與決策平台建置）</li>
              <li>光明健康事業 研發工程師兼董事長特助</li>
              <li>主導醫病共享決策 (SDM) 數位平台開發、明通化學製藥數位轉型</li>
            </ul>
          </div>
        </div>
        <div class="col-md-6">
          <div class="p-2 bg-light rounded-2 border-start border-3 border-success small">
            <strong class="text-dark"><i class="fas fa-flask text-success me-1"></i>學術研究成果與經歷：</strong>
            <ul class="mb-0 ps-3 text-secondary" style="font-size: 0.85rem;">
              <li>曾任國科會多年期研究計畫 研究助理</li>
              <li>於 Management Decision、Applied Economics 等國際期刊發表多篇論文</li>
              <li>榮獲富邦人壽管理博碩士論文獎 最佳博士論文肯定</li>
            </ul>
          </div>
        </div>
      </div>
      <p class="text-secondary small mb-2"><i class="fas fa-quote-left text-muted me-1"></i>${info.instructor.philosophy}</p>
      <div class="alert alert-light border small mb-0 py-2">
        <strong><i class="fas fa-bullhorn text-warning me-1"></i>給大一企管新鮮人的一句話：</strong>
        ${info.instructor.welcome_message}
      </div>
    `;
  }

  // 2. 評分標準卡片
  const gradingEl = document.getElementById('grading-policy-box');
  if (gradingEl && info && info.grading_policy) {
    const gp = info.grading_policy;
    gradingEl.innerHTML = `
      <div class="row g-3">
        <div class="col-md-4">
          <div class="grading-card h-100" style="border-left-color: #F59E0B;">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <h6 class="fw-bold mb-0 text-dark">${gp.classroom_participation.title}</h6>
              <span class="percentage-badge">${gp.classroom_participation.percentage}%</span>
            </div>
            <p class="small text-muted mb-2">${gp.classroom_participation.description}</p>
            <ul class="small ps-3 mb-0 text-secondary">
              ${gp.classroom_participation.breakdown.map(b => `<li><strong>${b.item} (${b.weight})</strong>: ${b.desc}</li>`).join('')}
            </ul>
          </div>
        </div>
        <div class="col-md-4">
          <div class="grading-card h-100" style="border-left-color: #0D9488;">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <h6 class="fw-bold mb-0 text-dark">${(gp.midterm_project || gp.assignments).title}</h6>
              <span class="percentage-badge">${(gp.midterm_project || gp.assignments).percentage}%</span>
            </div>
            <p class="small text-muted mb-2">${(gp.midterm_project || gp.assignments).description}</p>
            <ul class="small ps-3 mb-0 text-secondary">
              ${((gp.midterm_project || gp.assignments).breakdown || []).map(b => `<li><strong>${b.item} (${b.weight})</strong>: ${b.desc}</li>`).join('')}
            </ul>
          </div>
        </div>
        <div class="col-md-4">
          <div class="grading-card h-100" style="border-left-color: #4F46E5;">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <h6 class="fw-bold mb-0 text-dark">${gp.final_project.title}</h6>
              <span class="percentage-badge">${gp.final_project.percentage}%</span>
            </div>
            <p class="small text-muted mb-2">${gp.final_project.description}</p>
            <ul class="small ps-3 mb-0 text-secondary">
              ${gp.final_project.breakdown.map(b => `<li><strong>${b.item} (${b.weight})</strong>: ${b.desc}</li>`).join('')}
            </ul>
          </div>
        </div>
      </div>
      <div class="alert alert-warning border border-warning-subtle small mt-3 mb-0">
        <i class="fas fa-star text-warning me-1"></i><strong>${gp.bonus_clause}</strong>
      </div>
    `;
  }

  // 3. 渲染 18 週教案卡片
  const container = document.getElementById('curriculum-container');
  if (!container || !curriculumData.weeks) return;

  const weeks = curriculumData.weeks.filter(w => {
    if (filterPhase === 'all') return true;
    return w.phase.includes(filterPhase);
  });

  container.innerHTML = weeks.map(w => {
    return `
      <div class="col-lg-6 mb-3">
        <div class="week-card p-4 h-100">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <span class="week-badge">第 ${w.week} 週</span>
            <span class="badge bg-light text-secondary border">${w.phase}</span>
          </div>
          <h5 class="fw-bold text-dark mb-1">${w.title}</h5>
          <p class="text-primary small fw-semibold mb-3">${w.subtitle}</p>

          <div class="hook-box mb-2">
            <strong><i class="fas fa-fire me-1"></i>課堂痛點破冰 (Hook)：</strong>${w.hook}
          </div>

          <div class="concept-box mb-2">
            <strong><i class="fas fa-lightbulb me-1"></i>核心觀念心法 (Concept)：</strong>${w.concept}
          </div>

          <div class="demo-box mb-2">
            <div class="small fw-bold text-info mb-1"><i class="fas fa-terminal me-1"></i>課堂 AI 實務示範：</div>
            ${w.antigravity_demo}
          </div>

          <div class="small text-secondary mb-2">
            <strong><i class="fas fa-users text-warning me-1"></i>小組數位實作：</strong>${w.practice}
          </div>

          <div class="prompt-copy-box mb-3">
            <div class="d-flex justify-content-between align-items-center mb-1">
              <span class="fw-bold small text-dark"><i class="fas fa-code me-1 text-primary"></i>CLEAR 提示詞範本：</span>
              <button class="btn btn-sm btn-outline-secondary py-0 px-2" onclick="copyPromptText('${escapeJsString(w.clear_prompt)}')">
                <i class="fas fa-copy me-1"></i>複製
              </button>
            </div>
            <code>${w.clear_prompt}</code>
          </div>

          <div class="d-flex justify-content-between align-items-center pt-2 border-top">
            <span class="small text-muted"><i class="fas fa-book-reader me-1"></i>簡報：${w.slide_page}</span>
            <div class="d-flex gap-2">
              <a href="${getPresentationUrl()}" target="_blank" class="btn btn-outline-info btn-sm presentation-link">
                <i class="fas fa-tv me-1"></i>播放簡報
              </a>
              <button class="btn btn-primary btn-sm fw-semibold" onclick="startWeeklyQuiz(${w.week})">
                <i class="fas fa-pencil-alt me-1"></i>隨堂快測 (5題)
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function filterCurriculum(phase, btn) {
  document.querySelectorAll('.filter-phase-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderCurriculum(phase);
}

function escapeJsString(str) {
  if (!str) return '';
  return str.replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, ' ');
}

function copyPromptText(text) {
  navigator.clipboard.writeText(text).then(() => {
    alert('已成功複製提示詞規格！\n可直接貼至 ChatGPT、Claude、Gemini 或 Antigravity 使用。');
  });
}

function renderWorksheets() {
  const container = document.getElementById('worksheets-list-box');
  if (!container || !curriculumData || !curriculumData.worksheets) return;

  container.innerHTML = curriculumData.worksheets.map((ws, idx) => {
    return `
      <div class="list-group-item list-group-item-action py-2">
        <div class="d-flex justify-content-between align-items-center">
          <span class="fw-bold text-dark"><i class="fas fa-file-signature text-primary me-2"></i>${ws.title}</span>
          <span class="badge bg-light text-secondary border">第 ${ws.week} 週</span>
        </div>
        <p class="small text-muted mb-1 mt-1"><strong>框架：</strong>${ws.framework}</p>
        <button class="btn btn-sm btn-outline-primary py-0 px-2 mt-1" onclick="viewWorksheetDetail(${idx})">
          <i class="fas fa-eye me-1"></i>查閱工作表規範與範本
        </button>
      </div>
    `;
  }).join('');
}

function viewWorksheetDetail(idx) {
  const ws = curriculumData.worksheets[idx];
  if (!ws) return;

  let contentHtml = `
    <h5 class="fw-bold text-primary mb-2">${ws.title}</h5>
    <div class="badge bg-secondary mb-3">適用週次：第 ${ws.week} 週 ｜ 研討框架：${ws.framework}</div>
  `;

  if (ws.dimensions) {
    contentHtml += `
      <h6 class="fw-bold mt-2">五維指令模型解析：</h6>
      <ul class="small ps-3">
        ${ws.dimensions.map(d => `<li><strong>${d.name}</strong>：${d.desc}</li>`).join('')}
      </ul>
      <div class="alert alert-light border small">
        <strong>原始口語：</strong>${ws.sample_raw}<br>
        <strong class="text-success">優化後提示詞：</strong>${ws.sample_optimized}
      </div>
    `;
  } else if (ws.steps) {
    contentHtml += `
      <h6 class="fw-bold mt-2">小組研討引導步驟：</h6>
      <ul class="small ps-3">
        ${ws.steps.map(s => `<li><strong>${s.step}</strong>：${s.desc}</li>`).join('')}
      </ul>
    `;
  } else if (ws.fields) {
    contentHtml += `
      <h6 class="fw-bold mt-2">欄位分析重點：</h6>
      <ul class="small ps-3">
        ${ws.fields.map(f => `<li><strong>${f.name}</strong>：${f.desc}</li>`).join('')}
      </ul>
    `;
  } else if (ws.agents) {
    contentHtml += `
      <h6 class="fw-bold mt-2">三大虛擬特工配置：</h6>
      <ul class="small ps-3">
        ${ws.agents.map(a => `<li><strong>${a.role}</strong> (${a.persona})：${a.duty}</li>`).join('')}
      </ul>
    `;
  } else if (ws.pages) {
    contentHtml += `
      <h6 class="fw-bold mt-2">Pitch Deck 8 頁架構：</h6>
      <div class="row g-2 small">
        ${ws.pages.map(p => `<div class="col-6"><strong>${p.page} ${p.topic}</strong>：${p.desc}</div>`).join('')}
      </div>
    `;
  }

  showExportModal(ws.title, contentHtml, false);
}

/* ==========================================================================
   4. G104 課堂互動工具箱 (抽卡機、大轉盤、計時器)
   ========================================================================== */
function initClassroomTools() {
  drawWheelCanvas();
  drawRandomCards();
}

// 靈感抽卡機
async function drawRandomCards() {
  let cards = null;
  if (!isOfflineMode) {
    try {
      const res = await fetch('/api/random_cards');
      if (res.ok) cards = await res.json();
    } catch (e) {
      cards = null;
    }
  }

  if (!cards) {
    // 離線備援資料
    const targets = ['白天半工半讀的大一新生', '預算有限但重視健康的外宿租屋族', '每逢期末考面對磚頭厚原文書的企管同學', '宿舍洗烘衣機永遠排不到的住宿生'];
    const pains = ['月底生活費見底只吃泡麵帶來強烈自卑', '花了上千元買原文書但期末只能秤斤論兩賣', '下課急著打工但排隊買午餐花了半小時', '想找室友但怕遇到生活習慣不合的地雷'];
    const techs = ['Antigravity 單檔案 Vibe Coding 快速建置網站', 'LINE 官方帳號 ✕ 智慧對話 Agent 自動預約', 'ReAct 思考推理 Agent 比對二手書最優折扣', 'GitHub Pages 零成本託管 ✕ QR Code 掃碼'];
    const scenes = ['期末考前 48 小時校園救火大作戰', '開學第一週新生租屋與選書崩潰季', '每週一中午萬能學餐尖峰時刻', '週五傍晚大學生返鄉前行李大整理'];

    cards = {
      target: targets[Math.floor(Math.random() * targets.length)],
      pain: pains[Math.floor(Math.random() * pains.length)],
      tech: techs[Math.floor(Math.random() * techs.length)],
      scene: scenes[Math.floor(Math.random() * scenes.length)]
    };
  }

  // 加上微動效
  ['card-target', 'card-pain', 'card-tech', 'card-scene'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add('pulse');
      setTimeout(() => el.classList.remove('pulse'), 400);
    }
  });

  const tEl = document.querySelector('#card-target .card-text');
  const pEl = document.querySelector('#card-pain .card-text');
  const tcEl = document.querySelector('#card-tech .card-text');
  const sEl = document.querySelector('#card-scene .card-text');

  if (tEl) tEl.textContent = cards.target;
  if (pEl) pEl.textContent = cards.pain;
  if (tcEl) tcEl.textContent = cards.tech;
  if (sEl) sEl.textContent = cards.scene;

  unlockBadge('badge_idea_deck');
}

function applyCardsToAgent() {
  const target = document.querySelector('#card-target .card-text')?.textContent || '';
  const pain = document.querySelector('#card-pain .card-text')?.textContent || '';
  const scene = document.querySelector('#card-scene .card-text')?.textContent || '';

  if (!target || target === '點擊上方按鈕抽取') {
    alert('請先點擊【一鍵隨機抽卡】抽取靈感！');
    return;
  }

  // 切換至 AI 工坊 Tab
  switchTab('tab-takehome');

  // 自動帶入 Agent 1
  selectAgent(0);
  setTimeout(() => {
    const ugInput = document.getElementById('input-field-0');
    const rcInput = document.getElementById('input-field-1');
    const ctInput = document.getElementById('input-field-2');
    if (ugInput) ugInput.value = target;
    if (rcInput) rcInput.value = pain;
    if (ctInput) ctInput.value = `場景：${scene}；零啟動資金；萬能科大校園`;
    alert('已成功將靈感組合帶入【痛點雷達與 POV 問題定義 Agent】！\n請點擊「啟動 ReAct 推理模擬」。');
  }, 200);
}

// 創意大轉盤
function drawWheelCanvas() {
  const canvas = document.getElementById('canvas-wheel');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const numSegments = wheelNames.length;
  const anglePerSegment = (Math.PI * 2) / numSegments;
  const colors = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#8B5CF6', '#EC4899', '#14B8A6'];

  ctx.clearRect(0, 0, 320, 320);
  const cx = 160, cy = 160, r = 150;

  for (let i = 0; i < numSegments; i++) {
    const startAngle = wheelAngle + i * anglePerSegment;
    const endAngle = startAngle + anglePerSegment;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();
    ctx.stroke();

    // 繪製文字
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(startAngle + anglePerSegment / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px "Noto Sans TC", sans-serif';
    ctx.fillText(wheelNames[i], r - 20, 5);
    ctx.restore();
  }
}

function spinWheel() {
  if (isSpinning) return;
  isSpinning = true;

  const resultBox = document.getElementById('wheel-result-box');
  if (resultBox) resultBox.textContent = '轉盤旋轉中... 命運掌握在宇宙手中！';

  const extraSpins = 5 + Math.random() * 5; // 5 到 10 圈
  const randomOffset = Math.random() * Math.PI * 2;
  const targetAngle = wheelAngle + extraSpins * Math.PI * 2 + randomOffset;
  const duration = 4000;
  const startTime = performance.now();
  const startAngle = wheelAngle;

  function animate(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // easeOutCubic
    const ease = 1 - Math.pow(1 - progress, 3);
    wheelAngle = startAngle + (targetAngle - startAngle) * ease;
    drawWheelCanvas();

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      isSpinning = false;
      playBeepSound();
      determineWheelWinner();
    }
  }

  requestAnimationFrame(animate);
}

function determineWheelWinner() {
  const numSegments = wheelNames.length;
  const anglePerSegment = (Math.PI * 2) / numSegments;
  // 箭頭位於上方 12 點鐘位置 (-PI/2)
  let normalizedAngle = (1.5 * Math.PI - wheelAngle) % (Math.PI * 2);
  if (normalizedAngle < 0) normalizedAngle += Math.PI * 2;

  const winnerIndex = Math.floor(normalizedAngle / anglePerSegment) % numSegments;
  const winnerName = wheelNames[winnerIndex];

  const resultBox = document.getElementById('wheel-result-box');
  if (resultBox) {
    resultBox.innerHTML = `🎉 抽籤結果出爐：恭喜 <span class="badge bg-warning text-dark fs-5 px-3">${winnerName}</span> 請準備發表！`;
  }
}

function openWheelEditModal() {
  const input = document.getElementById('input-wheel-names');
  if (input) input.value = wheelNames.join('、');
  openModal('wheelEditModal');
}

function editWheelNames() {
  openWheelEditModal();
}

function setWheelPreset(names) {
  const input = document.getElementById('input-wheel-names');
  if (input) input.value = names.join('、');
}

function saveWheelNamesFromModal() {
  const input = document.getElementById('input-wheel-names');
  if (!input) return;
  const raw = input.value.trim();
  const list = raw.split(/[,，、\n\r]+/).map(s => s.trim()).filter(Boolean);
  if (list.length >= 2) {
    wheelNames = list;
    drawWheelCanvas();
    closeModal('wheelEditModal');
    const resBox = document.getElementById('wheel-result-box');
    if (resBox) resBox.textContent = `已成功載入 ${wheelNames.length} 組名單！點擊中間 SPIN 開始抽籤！`;
  } else {
    alert('請至少輸入 2 個名額或組別名稱！');
  }
}

// 課堂倒數計時器
function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function updateTimerDisplay() {
  const el = document.getElementById('timer-display-text');
  if (el) el.textContent = formatTime(workshopTimer.remaining);
}

function setTimerPreset(seconds, title) {
  if (workshopTimer.isRunning) {
    clearInterval(workshopTimer.interval);
    workshopTimer.isRunning = false;
    document.getElementById('btn-timer-start').innerHTML = '<i class="fas fa-play me-1"></i>開始倒數';
  }
  workshopTimer.duration = seconds;
  workshopTimer.remaining = seconds;
  workshopTimer.presetTitle = title;
  updateTimerDisplay();

  const badge = document.getElementById('timer-status-badge');
  if (badge) badge.textContent = `${title} (${Math.round(seconds / 60)}分鐘)`;
}

function toggleWorkshopTimer() {
  const btn = document.getElementById('btn-timer-start');
  const badge = document.getElementById('timer-status-badge');

  if (workshopTimer.isRunning) {
    // 暫停
    clearInterval(workshopTimer.interval);
    workshopTimer.isRunning = false;
    if (btn) btn.innerHTML = '<i class="fas fa-play me-1"></i>繼續倒數';
    if (badge) badge.textContent = '已暫停';
  } else {
    // 開始
    workshopTimer.isRunning = true;
    if (btn) btn.innerHTML = '<i class="fas fa-pause me-1"></i>暫停計時';
    if (badge) badge.textContent = `${workshopTimer.presetTitle} 倒數中...`;

    workshopTimer.interval = setInterval(() => {
      workshopTimer.remaining--;
      updateTimerDisplay();

      if (workshopTimer.remaining <= 0) {
        clearInterval(workshopTimer.interval);
        workshopTimer.isRunning = false;
        if (btn) btn.innerHTML = '<i class="fas fa-play me-1"></i>開始倒數';
        if (badge) badge.textContent = '時間到！請小組完成討論';
        playTimerAlarm();
        alert(`⏰ 【${workshopTimer.presetTitle}】時間到！\n請各組整理線上討論成果，準備進行成果交流！`);
      }
    }, 1000);
  }
}

function resetWorkshopTimer() {
  if (workshopTimer.interval) clearInterval(workshopTimer.interval);
  workshopTimer.isRunning = false;
  workshopTimer.remaining = workshopTimer.duration;
  updateTimerDisplay();
  const btn = document.getElementById('btn-timer-start');
  if (btn) btn.innerHTML = '<i class="fas fa-play me-1"></i>開始倒數';
  const badge = document.getElementById('timer-status-badge');
  if (badge) badge.textContent = '已重設';
}

function playBeepSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {}
}

function playTimerAlarm() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, ctx.currentTime + i * 0.25);
      gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.25);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.25 + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.25);
      osc.stop(ctx.currentTime + i * 0.25 + 0.2);
    }
  } catch (e) {}
}

/* ==========================================================================
   5. 回家練習：Antigravity & AI Agent 微型創業工坊
   ========================================================================== */
function renderAgentTemplates() {
  const btnsContainer = document.getElementById('agent-tab-btns');
  if (!btnsContainer || !agentTemplates || agentTemplates.length === 0) return;

  btnsContainer.innerHTML = agentTemplates.map((ag, idx) => {
    return `
      <button class="btn btn-sm ${idx === currentAgentIndex ? 'btn-primary' : 'btn-outline-secondary'} py-2 px-3 text-start" 
              onclick="selectAgent(${idx})" style="min-width: 170px;">
        <i class="fas ${ag.icon} me-1"></i>
        <strong>${ag.name.split(' ')[0]}</strong>
        <div class="small opacity-75" style="font-size: 0.72rem;">${ag.badge}</div>
      </button>
    `;
  }).join('');

  renderActiveAgent();
}

function selectAgent(idx) {
  currentAgentIndex = idx;
  renderAgentTemplates();
  renderActiveAgent();
}

function renderActiveAgent() {
  const container = document.getElementById('active-agent-workspace');
  const ag = agentTemplates[currentAgentIndex];
  if (!container || !ag) return;

  container.innerHTML = `
    <div class="d-flex justify-content-between align-items-start mb-3 border-bottom pb-2">
      <div>
        <div class="d-flex align-items-center gap-2">
          <i class="fas ${ag.icon} text-primary fs-4"></i>
          <h4 class="fw-bold mb-0 text-dark">${ag.name}</h4>
          <span class="badge bg-light text-secondary border">${ag.english_name}</span>
        </div>
        <p class="small text-muted mb-0 mt-1"><strong>角色人設：</strong>${ag.role} ｜ <strong>核心目標：</strong>${ag.goal}</p>
      </div>
      <span class="badge px-3 py-2" style="background-color: ${ag.color}; color: white;">${ag.badge}</span>
    </div>

    <!-- 輸入表單 -->
    <div class="row g-2 mb-3">
      ${ag.inputs.map((inp, i) => {
        const defaultVal = (inp.placeholder || '').replace(/^例[：:]\s*/, '');
        return `
        <div class="col-md-4 col-12">
          <label class="form-label small fw-bold text-dark">${inp.label}</label>
          <input type="text" class="form-control form-control-sm" id="input-field-${i}" placeholder="${inp.placeholder}" value="${defaultVal.replace(/"/g, '&quot;')}">
        </div>
      `;
      }).join('')}
    </div>

    <!-- 操作按鈕列 -->
    <div class="d-flex flex-wrap gap-2 mb-3">
      <button class="btn btn-primary btn-sm fw-bold px-3" onclick="runAgentSimulation()">
        <i class="fas fa-play me-1"></i>啟動 ReAct 推理模擬
      </button>
      <button class="btn btn-outline-dark btn-sm" onclick="copyAgentExternalPrompt()">
        <i class="fas fa-copy me-1"></i>複製外部 AI 黃金提示詞
      </button>
      <button class="btn btn-outline-success btn-sm" onclick="generateStartupProposalDraft()">
        <i class="fas fa-file-signature me-1"></i>生成一頁式創業企劃草案
      </button>
      <button class="btn btn-outline-info btn-sm" onclick="generateLandingPageCode()">
        <i class="fas fa-code me-1"></i>一鍵生成一頁式網頁原始碼
      </button>
    </div>

    <!-- ReAct 推理終端機與產出 -->
    <div class="row g-3">
      <div class="col-lg-7">
        <div class="react-terminal">
          <div class="terminal-header">
            <div class="terminal-dots">
              <div class="dot dot-red"></div>
              <div class="dot dot-yellow"></div>
              <div class="dot dot-green"></div>
            </div>
            <span class="small text-muted">ReAct Thought-Action-Observation Engine</span>
          </div>
          <div class="terminal-body" id="react-terminal-body">
            <div class="text-secondary small">準備就緒。點擊上方【啟動 ReAct 推理模擬】按鈕觀察智能體思考軌跡...</div>
          </div>
        </div>
      </div>
      <div class="col-lg-5">
        <div class="card-custom p-3 h-100 bg-white" style="border: 1px dashed #CBD5E1;">
          <h6 class="fw-bold text-dark mb-2"><i class="fas fa-check-circle text-success me-1"></i>Agent 交付產物草案</h6>
          <div id="agent-output-box" class="small text-secondary" style="max-height: 380px; overflow-y: auto;">
            <div class="text-muted text-center py-4">尚未執行推理。執行後將在此處即時渲染產出規格書。</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function runAgentSimulation() {
  const ag = agentTemplates[currentAgentIndex];
  if (!ag) return;

  const terminal = document.getElementById('react-terminal-body');
  const outputBox = document.getElementById('agent-output-box');
  if (!terminal || !outputBox) return;

  terminal.innerHTML = `<div class="text-info small mb-2"><i class="fas fa-spinner fa-spin me-1"></i>[SYSTEM] 啟動 ${ag.name}... 建立上下文環境...</div>`;

  const traces = ag.react_trace;
  for (let i = 0; i < traces.length; i++) {
    await new Promise(r => setTimeout(r, 600));
    const t = traces[i];
    let html = '';
    if (t.step.startsWith('Thought')) {
      html = `<div class="step-thought"><strong>[${t.step}]</strong> ${t.desc}</div>`;
    } else if (t.step.startsWith('Action')) {
      html = `<div class="step-action"><strong>[${t.step}]</strong> Tool Calling: <code>${t.tool || 'ExternalTool()'}</code> - ${t.desc}</div>`;
    } else if (t.step.startsWith('Observation')) {
      html = `<div class="step-obs"><strong>[${t.step}]</strong> ${t.desc}</div>`;
    } else {
      html = `<div class="step-decision"><strong>[${t.step}]</strong> ${t.desc}</div>`;
    }
    terminal.innerHTML += html;
    terminal.scrollTop = terminal.scrollHeight;
  }

  // 渲染成果預覽
  const ot = ag.output_template;
  let outHtml = `<h6 class="fw-bold text-primary border-bottom pb-1 mb-2">${ot.title || ag.name + ' 產出成果'}</h6>`;
  for (const [key, val] of Object.entries(ot)) {
    if (key === 'title') continue;
    if (typeof val === 'object' && !Array.isArray(val)) {
      outHtml += `<div class="mb-2"><strong>${key}：</strong><ul class="ps-3 mb-0">${Object.entries(val).map(([k, v]) => `<li><strong>${k}</strong>: ${v}</li>`).join('')}</ul></div>`;
    } else if (Array.isArray(val)) {
      outHtml += `<div class="mb-2"><strong>${key}：</strong><ul class="ps-3 mb-0">${val.map(v => `<li>${v}</li>`).join('')}</ul></div>`;
    } else {
      outHtml += `<div class="mb-2"><strong>${key}：</strong>${val}</div>`;
    }
  }
  outputBox.innerHTML = outHtml;

  unlockBadge('badge_agent_react');
}

function copyAgentExternalPrompt() {
  const ag = agentTemplates[currentAgentIndex];
  if (!ag) return;

  let prompt = ag.external_prompt;
  ag.inputs.forEach((inp, i) => {
    const val = document.getElementById(`input-field-${i}`)?.value.trim() || inp.placeholder.replace('例：', '');
    prompt = prompt.replace(new RegExp(`\\{${inp.field}\\}`, 'g'), val);
  });

  navigator.clipboard.writeText(prompt).then(() => {
    alert(`已複製【${ag.name}】結構化黃金提示詞！\n可直接貼入 ChatGPT、Claude、Gemini 或 Antigravity 進行深度對話！`);
  });
}

function generateStartupProposalDraft() {
  const ag = agentTemplates[currentAgentIndex];
  const userInputs = ag.inputs.map((inp, i) => {
    const val = document.getElementById(`input-field-${i}`)?.value.trim() || inp.placeholder.replace('例：', '');
    return `- **${inp.label}**：${val}`;
  }).join('\n');

  const mdContent = `
# 萬能科技大學【創意發想與微型創業】一頁式專案提案書

**提案組別/學生：** ${currentUser.studentName || '未登記'} (${currentUser.studentId || '企管四系1甲'})  
**指導教授：** 邱俊維 博士 ｜ **開課班級：** 企管四系1甲 ｜ **地點：** G104 多媒體教室  
**核心 Agent：** ${ag.name} (${ag.badge})  
**生成日期：** ${new Date().toLocaleDateString()}  

---

### 一、專案輸入參數與背景脈絡
${userInputs}

---

### 二、Agentic AI 核心推理與商業決策
${JSON.stringify(ag.output_template, null, 2)}

---

### 三、後續精實創業里程碑 (Milestones)
1. **第 6 週**：完成 Crazy 8s 與顧客同理心人物誌草繪。
2. **第 8 週**：啟動冒煙測試 (Smoke Test) 登陸頁假門實驗。
3. **第 15~16 週**：透過 Antigravity 產出 index.html 並部署於 GitHub Pages 公開上線。
4. **第 18 週**：Demo Day 成果發表會進行 3 分鐘 Pitch 與實體網頁展示！

*版權所有 © 2026 萬能科技大學 企管四系1甲 邱俊維 博士 團隊專用*
  `;

  showExportModal('一頁式微型創業企劃書草案', `<pre class="bg-light p-3 border rounded small"><code>${mdContent}</code></pre>`, true, mdContent, 'Micro_Startup_Proposal.md');
  unlockBadge('badge_proposal_draft');
}

function generateLandingPageCode() {
  const title = document.getElementById('input-field-0')?.value.trim() || '萬能校園歐趴救火包';
  const htmlCode = `<!DOCTYPE html>
<html lang="zh-TW" class="h-full">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} ｜ 萬能科大微型創業成果展示</title>
  <!-- Tailwind CSS CDN -->
  <script src="https://cdn.tailwindcss.com"><\/script>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700;900&display=swap" rel="stylesheet">
  <style>body { font-family: 'Noto Sans TC', sans-serif; }</style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-full flex flex-col">

  <!-- 導航列 -->
  <nav class="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
    <div class="flex items-center gap-2">
      <span class="bg-indigo-600 text-white font-black text-xs px-2.5 py-1 rounded">VNU</span>
      <span class="font-bold text-lg text-white">${title}</span>
    </div>
    <button onclick="document.getElementById('cta-modal').classList.remove('hidden')" class="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition shadow-md shadow-indigo-500/20">
      立即預約
    </button>
  </nav>

  <!-- Hero 英雄區 -->
  <header class="py-20 px-6 text-center max-w-4xl mx-auto flex-1 flex flex-col justify-center">
    <span class="text-indigo-400 font-semibold text-sm tracking-wider uppercase mb-3">期末救火 ✕ 敏捷實踐</span>
    <h1 class="text-4xl sm:text-5xl font-extrabold tracking-tight text-white mb-6 leading-tight">
      告別期末考焦慮，<br><span class="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-sky-300 to-emerald-400">用一杯奶茶的錢換一學期的安心！</span>
    </h1>
    <p class="text-slate-400 text-lg mb-8 max-w-2xl mx-auto">
      專為萬能科大學生打造・濃縮 18 週原文書精華重點 ✕ 聯名校園商家折價券，考前 48 小時極速通關！
    </p>
    <div class="flex justify-center gap-4">
      <button onclick="document.getElementById('cta-modal').classList.remove('hidden')" class="bg-gradient-to-r from-indigo-600 to-sky-600 text-white font-bold px-8 py-3.5 rounded-xl shadow-lg shadow-indigo-600/30 hover:opacity-95 transition">
        免費領取第一章試讀包 👉
      </button>
    </div>
  </header>

  <!-- 特色卡片 -->
  <section class="py-16 px-6 bg-slate-900/50 border-t border-slate-800">
    <div class="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
      <div class="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 transition">
        <div class="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-xl mb-4">01</div>
        <h3 class="text-lg font-bold text-white mb-2">考前重點精煉</h3>
        <p class="text-slate-400 text-sm">歷屆考古題高頻考點解析，省去翻找原文書的數十小時。</p>
      </div>
      <div class="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-sky-500/50 transition">
        <div class="w-12 h-12 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center font-bold text-xl mb-4">02</div>
        <h3 class="text-lg font-bold text-white mb-2">校園商家聯名券</h3>
        <p class="text-slate-400 text-sm">每份盲盒附贈學餐與周邊飲料店折價券，買筆記還能賺回餐費。</p>
      </div>
      <div class="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-emerald-500/50 transition">
        <div class="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-xl mb-4">03</div>
        <h3 class="text-lg font-bold text-white mb-2">匿名互助答客問</h3>
        <p class="text-slate-400 text-sm">不懂隨時在線發問，學長姐 AI 智能體 24 小時秒速解惑。</p>
      </div>
    </div>
  </section>

  <!-- 頁尾 -->
  <footer class="py-8 px-6 text-center text-slate-600 text-xs border-t border-slate-900 mt-auto">
    萬能科技大學 企管四系1甲 創意發想與實踐 專案成果展示 ｜ 指導老師：邱俊維 博士
  </footer>

  <!-- 互動 Modal 彈窗 -->
  <div id="cta-modal" class="fixed inset-0 bg-black/70 backdrop-blur-sm hidden flex items-center justify-center p-4 z-50">
    <div class="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 text-left">
      <h3 class="text-xl font-bold text-white mb-2">預購早鳥名額</h3>
      <p class="text-slate-400 text-sm mb-4">留下您的 Email，試讀版上線時將第一時間寄送給您！</p>
      <input type="email" id="email-input" placeholder="student@mail.vnu.edu.tw" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white mb-4 text-sm focus:outline-none focus:border-indigo-500">
      <div class="flex justify-end gap-2">
        <button onclick="document.getElementById('cta-modal').classList.add('hidden')" class="px-4 py-2 text-slate-400 text-sm">取消</button>
        <button onclick="alert('感謝登記！已記錄您的預購意向。'); document.getElementById('cta-modal').classList.add('hidden');" class="bg-indigo-600 text-white text-sm font-semibold px-5 py-2 rounded-lg">確認送出</button>
      </div>
    </div>
  </div>

</body>
</html>`;

  showExportModal('單檔案一頁式專案網站原型 (index.html)', `<pre class="bg-dark text-light p-3 border rounded small"><code>${escapeHtml(htmlCode)}</code></pre>`, true, htmlCode, 'index.html');
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ==========================================================================
   6. 核心素養檢定與題庫中心
   ========================================================================== */
function initQuizSystem() {
  // ready
}

function startWeeklyQuiz(weekNum) {
  const filtered = questionsData.filter(q => q.weeks && q.weeks.includes(weekNum));
  const qList = (filtered.length >= 5) ? filtered.slice(0, 5) : questionsData.slice(0, 5);

  activeQuiz.questions = qList;
  activeQuiz.currentIndex = 0;
  activeQuiz.userAnswers = {};
  activeQuiz.timerSeconds = 0;
  activeQuiz.examModeTitle = `第 ${weekNum} 週隨堂 5 題快測`;

  openQuizModal();
}

function startQuiz(mode) {
  let list = [...questionsData];
  let title = '隨堂測驗';

  if (mode === 'weekly_5') {
    list.sort(() => 0.5 - Math.random());
    list = list.slice(0, 5);
    title = '每週 5 題隨堂快測';
  } else if (mode === 'ipas_brand_50') {
    const filtered = list.filter(q => q.cert && q.cert.includes('品牌規劃師'));
    list = (filtered.length >= 50 ? filtered : list).sort(() => 0.5 - Math.random()).slice(0, 50);
    title = 'iPAS 品牌規劃師 50 題全真模考';
  } else if (mode === 'ipas_ai_50') {
    const filtered = list.filter(q => q.cert && q.cert.includes('AI 應用規劃師'));
    list = (filtered.length >= 50 ? filtered : list).sort(() => 0.5 - Math.random()).slice(0, 50);
    title = 'iPAS AI 應用規劃師 50 題全真模考';
  } else if (mode === 'midterm_50') {
    const filtered = list.filter(q => q.chapter <= 9);
    list = (filtered.length >= 50 ? filtered : list).sort(() => 0.5 - Math.random()).slice(0, 50);
    title = '期中 50 題階段全真模考 (前9週)';
  } else if (mode === 'final_60') {
    list.sort(() => 0.5 - Math.random());
    list = list.slice(0, 60);
    title = '期末 60 題雙證照衝刺大會考';
  }

  activeQuiz.questions = list;
  activeQuiz.currentIndex = 0;
  activeQuiz.userAnswers = {};
  activeQuiz.timerSeconds = 0;
  activeQuiz.examModeTitle = title;

  openQuizModal();
}

function openModulePracticeModal() {
  openModal('modulePracticeModal');
}

function startModuleQuiz(targetComp) {
  closeModal('modulePracticeModal');
  const filtered = questionsData.filter(q => q.competency === targetComp);
  const list = (filtered.length > 0 ? filtered : questionsData).slice(0, 10);

  activeQuiz.questions = [...list].sort(() => 0.5 - Math.random());
  activeQuiz.currentIndex = 0;
  activeQuiz.userAnswers = {};
  activeQuiz.timerSeconds = 0;
  activeQuiz.examModeTitle = `主題加強：${targetComp} (10題)`;

  openQuizModal();
}

function openQuizModal() {
  const modalEl = document.getElementById('quizModal');
  if (!modalEl) return;

  const badgeEl = document.getElementById('quiz-badge-mode');
  if (badgeEl) badgeEl.textContent = activeQuiz.examModeTitle;
  renderCurrentQuestion();

  // 啟動計時器
  if (activeQuiz.timerInterval) clearInterval(activeQuiz.timerInterval);
  activeQuiz.timerInterval = setInterval(() => {
    activeQuiz.timerSeconds++;
    const tEl = document.getElementById('quiz-timer-text');
    if (tEl) tEl.innerHTML = `<i class="fas fa-clock me-1"></i>${formatTime(activeQuiz.timerSeconds)}`;
  }, 1000);

  openModal('quizModal');
}

function renderCurrentQuestion() {
  const q = activeQuiz.questions[activeQuiz.currentIndex];
  if (!q) return;

  const total = activeQuiz.questions.length;
  const certBadge = q.cert ? `<span class="badge bg-primary me-1">${q.cert}</span>` : '';
  const subjBadge = q.subject ? `<span class="badge bg-info text-dark me-1">${q.subject}</span>` : '';
  const compBadge = `<span class="badge bg-secondary me-1">${q.competency || ''}</span>`;
  const diffBadge = `<span class="badge bg-light text-dark border">${q.difficulty || '全真考題'}</span>`;

  const titleEl = document.getElementById('quiz-modal-title');
  if (titleEl) {
    titleEl.innerHTML = `${certBadge} ${subjBadge} <span class="d-none d-md-inline">${compBadge}</span>`;
  }
  const progEl = document.getElementById('quiz-progress-text');
  if (progEl) progEl.textContent = `題號 ${activeQuiz.currentIndex + 1} / ${total}`;

  const prevBtn = document.getElementById('btn-quiz-prev');
  const nextBtn = document.getElementById('btn-quiz-next');
  const submitBtn = document.getElementById('btn-quiz-submit');

  if (prevBtn) prevBtn.disabled = (activeQuiz.currentIndex === 0);
  if (nextBtn) nextBtn.style.display = (activeQuiz.currentIndex === total - 1) ? 'none' : 'inline-block';
  if (submitBtn) submitBtn.style.display = (activeQuiz.currentIndex === total - 1) ? 'inline-block' : 'none';

  const selectedOpt = activeQuiz.userAnswers[q.id];

  const body = document.getElementById('quiz-modal-body');
  body.innerHTML = `
    <div class="mb-3">
      <div class="d-flex flex-wrap align-items-center gap-1 mb-2">
        <span class="badge bg-dark">第 ${q.chapter} 週 ｜ ${q.chapter_title}</span>
        ${q.cert ? `<span class="badge bg-primary">${q.cert}</span>` : ''}
        ${q.subject ? `<span class="badge bg-info text-dark">${q.subject}</span>` : ''}
        <span class="badge bg-secondary">${q.competency}</span>
        <span class="badge bg-light text-secondary border">${q.difficulty}</span>
      </div>
      <h5 class="fw-bold text-dark mb-3" style="line-height: 1.5;">${activeQuiz.currentIndex + 1}. ${q.question}</h5>
    </div>
    <div class="options-list">
      ${q.options.map((opt, idx) => `
        <div class="quiz-option ${selectedOpt === idx ? 'selected' : ''}" onclick="selectQuizOption(${idx})">
          <div class="d-flex align-items-center">
            <span class="badge ${selectedOpt === idx ? 'bg-primary' : 'bg-light text-dark border'} me-3" style="width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">
              ${String.fromCharCode(65 + idx)}
            </span>
            <span class="flex-grow-1">${opt}</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function selectQuizOption(optIdx) {
  const q = activeQuiz.questions[activeQuiz.currentIndex];
  if (!q) return;
  activeQuiz.userAnswers[q.id] = optIdx;
  renderCurrentQuestion();
}

function nextQuizQuestion() {
  if (activeQuiz.currentIndex < activeQuiz.questions.length - 1) {
    activeQuiz.currentIndex++;
    renderCurrentQuestion();
  }
}

function prevQuizQuestion() {
  if (activeQuiz.currentIndex > 0) {
    activeQuiz.currentIndex--;
    renderCurrentQuestion();
  }
}

function abortQuiz() {
  if (activeQuiz.timerInterval) clearInterval(activeQuiz.timerInterval);
}

async function submitQuizAnswers() {
  if (activeQuiz.timerInterval) clearInterval(activeQuiz.timerInterval);

  // 驗證是否全部作答
  const answeredCount = Object.keys(activeQuiz.userAnswers).length;
  const total = activeQuiz.questions.length;
  if (answeredCount < total) {
    if (!confirm(`您還有 ${total - answeredCount} 題尚未作答，確定要現在交卷評分嗎？`)) {
      return;
    }
  }

  let result = null;
  if (!isOfflineMode) {
    try {
      const res = await fetch('/api/submit_quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: currentUser.studentId || '匿名學生',
          student_name: currentUser.studentName || '同學',
          answers: activeQuiz.userAnswers,
          exam_mode: activeQuiz.examModeTitle
        })
      });
      if (res.ok) result = await res.json();
    } catch (e) {
      result = null;
    }
  }

  // 離線計分演算法
  if (!result) {
    let correct = 0;
    const wrong = [];
    const compStats = {};

    activeQuiz.questions.forEach(q => {
      const uAns = activeQuiz.userAnswers[q.id];
      const comp = q.competency || '生成式 AI 與提示工程';
      if (!compStats[comp]) compStats[comp] = { correct: 0, total: 0 };
      compStats[comp].total++;

      if (uAns !== undefined && parseInt(uAns) === parseInt(q.answer)) {
        correct++;
        compStats[comp].correct++;
      } else {
        wrong.push({
          id: q.id,
          chapter_title: q.chapter_title,
          competency: comp,
          question: q.question,
          options: q.options,
          user_answer: uAns !== undefined ? uAns : -1,
          correct_answer: q.answer,
          explanation: q.explanation
        });
      }
    });

    const score = Math.round((correct / total) * 100);
    result = {
      score: score,
      passed: score >= 70,
      correct_count: correct,
      total_questions: total,
      feedback: score >= 90 ? '太優秀了！iPAS 品牌規劃師與 AI 應用規劃師核心素養達到頂尖水準！' : (score >= 70 ? '恭喜合格達標！已充分掌握 iPAS 雙證照考點，具備考照競爭力！' : '請加強複習錯題！建議針對下方弱點素養維度進行專項練習。'),
      competency_radar: compStats,
      wrong_questions: wrong
    };
  }

  // 記錄錯題至 Set 與 LocalStorage
  if (result.wrong_questions) {
    result.wrong_questions.forEach(wq => wrongQuestionsSet.add(wq.id));
    localStorage.setItem('vnu_ideation_wrong_q', JSON.stringify([...wrongQuestionsSet]));
    renderWrongQuestions();
  }

  // 觸發成就解鎖
  unlockBadge('badge_weekly_quiz');
  if (result.score >= 90) unlockBadge('badge_score_90');

  renderQuizReport(result);
  renderRadarChart(result.competency_radar);
}

function renderQuizReport(res) {
  const body = document.getElementById('quiz-modal-body');
  const footer = document.getElementById('quiz-modal-footer');
  if (!body) return;

  const scoreColor = res.score >= 70 ? 'text-success' : 'text-danger';

  body.innerHTML = `
    <div class="text-center py-3">
      <div class="display-3 fw-black ${scoreColor} mb-1">${res.score} <span class="fs-4">分</span></div>
      <div class="badge ${res.passed ? 'bg-success' : 'bg-danger'} px-3 py-1 fs-6 mb-3">
        ${res.passed ? '🎉 測驗及格 (PASSED)' : '⚠️ 仍需努力 (NEEDS REVIEW)'}
      </div>
      <p class="text-muted small mb-3">答對題數：${res.correct_count} / ${res.total_questions} 題 ｜ 用時：${formatTime(activeQuiz.timerSeconds)}</p>
      <div class="alert ${res.passed ? 'alert-success' : 'alert-warning'} small mb-4">${res.feedback}</div>
    </div>

    ${res.wrong_questions && res.wrong_questions.length > 0 ? `
      <h6 class="fw-bold text-dark mb-2"><i class="fas fa-exclamation-triangle text-warning me-1"></i>本次測驗錯題檢討 (${res.wrong_questions.length} 題)：</h6>
      <div class="accordion" id="wrongAccordion">
        ${res.wrong_questions.map((wq, i) => `
          <div class="accordion-item mb-2 border rounded">
            <h2 class="accordion-header">
              <button class="accordion-button collapsed py-2 px-3 small" type="button" onclick="toggleAccordion('collapse-${i}')">
                <span class="badge bg-danger me-2">錯</span> ${wq.question.substring(0, 35)}...
              </button>
            </h2>
            <div id="collapse-${i}" class="accordion-collapse collapse" style="display: none;">
              <div class="accordion-body small bg-light">
                <p class="fw-bold text-dark mb-2">${wq.question}</p>
                <div class="text-danger mb-1">您的作答：${wq.user_answer >= 0 ? wq.options[wq.user_answer] : '未作答'}</div>
                <div class="text-success fw-bold mb-2">正確答案：${wq.options[wq.correct_answer]}</div>
                <div class="alert alert-light border py-1 px-2 mb-0 small"><strong>詳解說明：</strong>${wq.explanation}</div>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    ` : '<div class="alert alert-success text-center py-3">全數答對！沒有任何錯題！太完美了！</div>'}
  `;

  if (footer) {
    footer.innerHTML = `
      <button class="btn btn-secondary btn-sm" onclick="closeModal('quizModal'); abortQuiz();">關閉視窗</button>
      <button class="btn btn-primary btn-sm" onclick="startQuiz('weekly_5')">再測一次</button>
    `;
  }
}

function toggleAccordion(collapseId) {
  const el = document.getElementById(collapseId);
  if (!el) return;
  const isShown = (el.style.display === 'block' || el.classList.contains('show'));
  if (isShown) {
    el.classList.remove('show');
    el.style.display = 'none';
  } else {
    el.classList.add('show');
    el.style.display = 'block';
  }
}

/* ==========================================================================
   7. 純前端 SVG 五大專業能力落點雷達圖
   ========================================================================== */
function renderRadarChart(stats = null) {
  const container = document.getElementById('radar-chart-box');
  if (!container) return;

  const dimensions = [
    { name: '生成式 AI 與提示工程', defaultScore: 88 },
    { name: '消費者洞察與需求分析', defaultScore: 85 },
    { name: '商業模式與精實驗證', defaultScore: 82 },
    { name: '品牌策略與整合行銷', defaultScore: 86 },
    { name: 'AI 系統規劃與倫理法規', defaultScore: 80 }
  ];

  const scores = dimensions.map(d => {
    if (stats && stats[d.name]) {
      const s = stats[d.name];
      return s.total > 0 ? Math.round((s.correct / s.total) * 100) : 50;
    }
    return d.defaultScore;
  });

  const size = 300;
  const cx = 150, cy = 150, r = 100;
  const numAxes = dimensions.length;
  const anglePerAxis = (Math.PI * 2) / numAxes;

  // 繪製背景多邊形網格
  let gridSvg = '';
  for (let level = 1; level <= 4; level++) {
    const levelR = (r / 4) * level;
    let points = [];
    for (let i = 0; i < numAxes; i++) {
      const angle = -Math.PI / 2 + i * anglePerAxis;
      const x = cx + levelR * Math.cos(angle);
      const y = cy + levelR * Math.sin(angle);
      points.push(`${x},${y}`);
    }
    gridSvg += `<polygon points="${points.join(' ')}" fill="none" stroke="#E2E8F0" stroke-width="1" />`;
  }

  // 繪製軸線與文字標籤
  let axesSvg = '';
  let dataPoints = [];
  for (let i = 0; i < numAxes; i++) {
    const angle = -Math.PI / 2 + i * anglePerAxis;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    axesSvg += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#CBD5E1" stroke-width="1" />`;

    // 數據多邊形點位
    const scoreVal = Math.max(scores[i], 10);
    const dataR = (r * scoreVal) / 100;
    const dx = cx + dataR * Math.cos(angle);
    const dy = cy + dataR * Math.sin(angle);
    dataPoints.push(`${dx},${dy}`);

    // 文字標籤位移
    const labelR = r + 24;
    const lx = cx + labelR * Math.cos(angle);
    const ly = cy + labelR * Math.sin(angle) + 4;
    axesSvg += `<text x="${lx}" y="${ly}" font-size="11" font-weight="bold" fill="#475569" text-anchor="middle">${dimensions[i].name} (${scores[i]}%)</text>`;
  }

  const svgContent = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      ${gridSvg}
      ${axesSvg}
      <!-- 數據多邊形 -->
      <polygon points="${dataPoints.join(' ')}" fill="rgba(79, 70, 229, 0.25)" stroke="#4F46E5" stroke-width="2.5" />
      ${dataPoints.map(p => `<circle cx="${p.split(',')[0]}" cy="${p.split(',')[1]}" r="4" fill="#F59E0B" stroke="#FFFFFF" stroke-width="1.5" />`).join('')}
    </svg>
  `;

  container.innerHTML = svgContent;
}

/* ==========================================================================
   8. 個人錯題筆記本
   ========================================================================== */
function renderWrongQuestions() {
  const container = document.getElementById('wrong-questions-container');
  if (!container) return;

  if (wrongQuestionsSet.size === 0) {
    container.innerHTML = '<div class="text-center text-muted py-4"><i class="fas fa-check-circle text-success me-1"></i>目前沒有任何錯題記錄！</div>';
    return;
  }

  const qMap = { ...questionsData.reduce((acc, q) => ({ ...acc, [q.id]: q }), {}) };
  const wrongList = [...wrongQuestionsSet].map(id => qMap[id]).filter(Boolean);

  container.innerHTML = wrongList.map(q => {
    return `
      <div class="border rounded p-2 mb-2 bg-light small">
        <div class="d-flex justify-content-between">
          <span class="fw-bold text-dark">${q.id}. ${q.question}</span>
          <span class="badge bg-danger">錯</span>
        </div>
        <div class="text-success fw-semibold mt-1">正解：${q.options[q.answer]}</div>
        <div class="text-muted mt-1" style="font-size: 0.78rem;"><strong>詳解：</strong>${q.explanation}</div>
      </div>
    `;
  }).join('');
}

function retryWrongQuestions() {
  if (wrongQuestionsSet.size === 0) {
    alert('目前錯題筆記本為空，無需重練！');
    return;
  }
  const qMap = { ...questionsData.reduce((acc, q) => ({ ...acc, [q.id]: q }), {}) };
  const list = [...wrongQuestionsSet].map(id => qMap[id]).filter(Boolean);

  activeQuiz.questions = list;
  activeQuiz.currentIndex = 0;
  activeQuiz.userAnswers = {};
  activeQuiz.timerSeconds = 0;
  activeQuiz.examModeTitle = `錯題重練專區 (${list.length}題)`;

  openQuizModal();
}

/* ==========================================================================
   9. 匯出預覽 Modal 控制
   ========================================================================== */
let modalCopyBuffer = '';
let modalDownloadFilename = 'export.txt';

function showExportModal(title, htmlContent, enableActions = true, rawText = '', filename = 'export.txt') {
  document.getElementById('export-modal-title').textContent = title;
  document.getElementById('export-modal-content').innerHTML = htmlContent;

  modalCopyBuffer = rawText || htmlContent;
  modalDownloadFilename = filename;

  const btnCopy = document.getElementById('btn-modal-copy');
  const btnDown = document.getElementById('btn-modal-download');
  if (btnCopy) btnCopy.style.display = enableActions ? 'inline-block' : 'none';
  if (btnDown) btnDown.style.display = enableActions ? 'inline-block' : 'none';

  openModal('exportModal');
}

function copyModalContent() {
  navigator.clipboard.writeText(modalCopyBuffer).then(() => {
    alert('已複製到剪貼簿！');
  });
}

function downloadModalContent() {
  const blob = new Blob([modalCopyBuffer], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = modalDownloadFilename;
  a.click();
}

function toggleEmbeddedPresentation() {
  const wrapper = document.getElementById('embedded-presentation-wrapper');
  if (!wrapper) return;
  const isHidden = (wrapper.style.display === 'none' || !wrapper.style.display);
  if (isHidden) {
    const iframe = document.getElementById('presentation-iframe');
    if (iframe) {
      iframe.src = getPresentationUrl();
    }
    wrapper.style.display = 'block';
  } else {
    wrapper.style.display = 'none';
  }
}

/* ==========================================================================
   VIBE CODING 操作手冊與教師 LIVE DEMO 互動函式
   ========================================================================== */
function scrollToElement(elementId) {
  const el = document.getElementById(elementId);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function copyTeacherDemoPrompt() {
  const promptEl = document.getElementById('teacher-demo-prompt');
  if (!promptEl) return;
  const text = promptEl.innerText.trim();
  navigator.clipboard.writeText(text).then(() => {
    alert('已複製教師 Live Demo 示範 Prompt！可直接貼給 AI 或帶入工坊體驗。');
  }).catch(() => {
    prompt('請按 Ctrl+C 複製下方提示詞：', text);
  });
}

function applyDemoToAgentWorkspace() {
  // 切換至 AI 創業工坊 tab
  switchTab('tab-takehome');
  // 選取一頁式原型設計 Agent (第 3 個，index 2)
  if (typeof selectAgent === 'function') {
    selectAgent(2);
  }
  // 填入預設題目與痛點
  setTimeout(() => {
    const inputTitle = document.getElementById('agent-input-title');
    const inputPain = document.getElementById('agent-input-pain');
    if (inputTitle) inputTitle.value = '萬能校園健康輕食 10 分鐘秒速外帶預約';
    if (inputPain) inputPain.value = '中午學餐大排長龍導致下午第一堂經常遲到，且外食高油高鈉，想吃健康輕食卻耗時。';
  }, 100);
}

/* ==========================================================================
   學生作品上傳與展示中心 (PORTFOLIO & SUBMISSION SYSTEM)
   ========================================================================== */
function updatePortfolioUserInfo() {
  const userDisp = document.getElementById('portfolio-user-display');
  const teamDisp = document.getElementById('portfolio-team-display');
  if (!userDisp) return;

  if (userProfile && userProfile.studentId) {
    userDisp.textContent = `${userProfile.studentId} ${userProfile.name || ''}`;
    if (teamDisp) {
      const gNum = userProfile.studentGroup || userProfile.group || '1';
      teamDisp.textContent = `班級：企管四系1甲 ｜ 所屬：第 ${gNum} 組 (已綁定)`;
    }
  } else {
    userDisp.textContent = '未登記學號與組別 (點右側按鈕登入以選組)';
    if (teamDisp) teamDisp.textContent = '班級：企管四系1甲 (尚未選組)';
  }
}

async function initStudentWorks() {
  updatePortfolioUserInfo();

  // 1. 嘗試從伺服器端取得
  try {
    const resp = await fetch('/api/student_works');
    if (resp.ok) {
      const data = await resp.json();
      if (Array.isArray(data) && data.length > 0) {
        studentWorksData = data;
        renderStudentWorks();
        return;
      }
    }
  } catch (err) {
    // 離線單機模式或網路不通
  }

  // 2. 伺服器離線或單機開啟：嘗試從 localStorage 取得
  const localSaved = localStorage.getItem('vnu_ideation_works');
  if (localSaved) {
    try {
      const parsed = JSON.parse(localSaved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        studentWorksData = parsed;
        renderStudentWorks();
        return;
      }
    } catch (e) {
      console.warn('解析本地作業失敗', e);
    }
  }

  // 3. 若本地無資料，檢查 window.OFFLINE_WORKS 或使用內建示範作品
  if (window.OFFLINE_WORKS && Array.isArray(window.OFFLINE_WORKS)) {
    studentWorksData = window.OFFLINE_WORKS;
  } else {
    studentWorksData = [
      {
        id: "WORK-2026-001",
        student_id: "11209012",
        student_name: "陳品妤",
        team_name: "第 1 組 - 救救荷包隊",
        week: 6,
        week_title: "第 06 週：精實創業與最小可行性產品 (MVP) 實務",
        title: "萬能二手原文書與學霸筆記即時媒合平台",
        category: "HTML 一頁式 MVP 登陸頁",
        concept: "解決企管系同學每學期買原文書花費數千元、期末卻只能賤賣的痛點。透過 Agentic AI 自動比對書況、版次與學長姐筆記，提供預購與面交登記。",
        agent_used: "一頁式創業原型設計 Agent ✕ 商業模式規劃 Agent",
        prompt_summary: "使用 CLEAR 框架引導 AI 生成具備 TailwindCSS 深藍風格之首頁、三大學長姐推薦書單、與 Google 表單串接之預訂彈窗。",
        live_url: "",
        file_name: "vnu_textbook_mvp.html",
        submitted_at: "2026-10-18 14:35:20",
        score: 95,
        teacher_comment: "痛點洞察極為深刻！首頁 Call to Action 醒目，手機版適應性良好，非常適合校園落地！"
      },
      {
        id: "WORK-2026-002",
        student_id: "11209028",
        student_name: "林宏宇",
        team_name: "第 3 組 - 萬能吃飽飽",
        week: 8,
        week_title: "第 08 週：冒煙測試 (Smoke Test) 與早鳥客戶意向驗證",
        title: "下課 10 分鐘秒速自取！健康舒肥輕食外帶預約頁",
        category: "HTML 一頁式 MVP 登陸頁",
        concept: "針對中午萬能學餐大排長龍導致下午第一堂課經常遲到的痛點，建立免排隊的預約取餐網頁，測試學生的付費與早鳥登記意願。",
        agent_used: "痛點雷達 Agent ✕ 一頁式原型 Agent",
        prompt_summary: "讓 AI 扮演連鎖餐飲產品經理，設計高對比健康綠橘色調、菜單輪播卡片與下課前 10 分鐘自取倒數提醒。",
        live_url: "",
        file_name: "healthy_meal_box.html",
        submitted_at: "2026-11-02 11:20:15",
        score: 92,
        teacher_comment: "冒煙測試的定價假設符合校園市場行情，表單驗證機制完整。"
      },
      {
        id: "WORK-2026-003",
        student_id: "11209045",
        student_name: "張子軒",
        team_name: "第 5 組 - 租屋救星",
        week: 9,
        week_title: "第 09 週：期中商業企劃書成果發表與評審回饋",
        title: "外宿新生好室友雷達：生活作息與習慣媒合服務企劃書",
        category: "商業企劃書與架構規格",
        concept: "解決大一新生外宿常遇到抽菸、衛生習慣不合的地雷室友問題。利用心理測驗與 Agentic AI 比對，媒合彼此生活習慣契合的合租夥伴。",
        agent_used: "商業模式九宮格 Agent ✕ 行銷文案特工",
        prompt_summary: "運用 Antigravity 梳理出精實商業模式圖 (BMC)、三階段收益模型（媒合手續費、房東贊助廣告）與損益兩平試算。",
        live_url: "",
        file_name: "roommate_finder_proposal.pdf",
        submitted_at: "2026-11-09 15:40:00",
        score: 96,
        teacher_comment: "期中提案邏輯嚴密！目標客群定義精準，且針對個資隱私防護有提出明確因應對策。"
      }
    ];
  }
  renderStudentWorks();
}

function renderStudentWorks() {
  const container = document.getElementById('works-cards-container');
  const countBadge = document.getElementById('total-works-count');
  if (!container) return;

  let works = [...studentWorksData];

  // 篩選模式
  if (currentWorksFilter === 'mine') {
    const currentId = currentUser.studentId ? currentUser.studentId.trim() : '';
    const currentEmail = (currentFirebaseUser && currentFirebaseUser.email) ? currentFirebaseUser.email.trim().toLowerCase() : '';
    if (!currentId && !currentEmail) {
      container.innerHTML = `
        <div class="text-center py-5 text-muted">
          <i class="fas fa-id-card fs-1 text-secondary mb-2"></i>
          <p class="mb-2">尚未登入學號或 Google 帳號，無法顯示您的專屬繳交紀錄。</p>
          <button class="btn btn-sm btn-primary" onclick="openModal('userProfileModal')">立即登記學號</button>
        </div>
      `;
      if (countBadge) countBadge.textContent = `我的作業：0 件`;
      return;
    }
    works = works.filter(w => {
      const matchId = (w.student_id && currentId && w.student_id.trim() === currentId);
      const matchEmail = (w.email && currentEmail && w.email.trim().toLowerCase() === currentEmail);
      const matchUid = (w.uid && currentFirebaseUser && w.uid === currentFirebaseUser.uid);
      return matchId || matchEmail || matchUid;
    });
  }

  if (countBadge) {
    countBadge.textContent = currentWorksFilter === 'mine' ? `我的作業：${works.length} 件` : `全班成果：${works.length} 件`;
  }

  if (works.length === 0) {
    container.innerHTML = `
      <div class="text-center py-5 text-muted">
        <i class="fas fa-folder-open fs-1 text-secondary mb-2"></i>
        <p class="mb-0">目前尚無繳交之成果，快在左側提交你的第一件微型創業作品！</p>
      </div>
    `;
    return;
  }

  let html = '';
  works.forEach(w => {
    const isHtmlWork = (w.category && w.category.includes('HTML')) || (w.file_name && (w.file_name.endsWith('.html') || w.file_name.endsWith('.htm'))) || Boolean(w.html_content);
    const scoreBadge = (w.score !== null && w.score !== undefined) ? `<span class="badge bg-warning text-dark fw-bold"><i class="fas fa-star text-danger me-1"></i>評分：${w.score} 分</span>` : `<span class="badge bg-secondary">教師審核中</span>`;
    const individualBadge = `<span class="badge bg-dark text-light border me-1"><i class="fas fa-user-check me-1"></i>個人實作</span>`;
    const thumbnailBg = w.thumbnail || 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)';
    const thumbnailIcon = w.thumbnail_icon || 'fas fa-laptop-code';

    // 教師專屬評分按鈕
    const teacherGradeBtn = isTeacherUser ? `
      <button class="btn btn-sm btn-warning text-dark fw-bold" onclick="openTeacherGradeModal('${escapeHtml(w.id)}')">
        <i class="fas fa-edit me-1"></i>教師評分
      </button>
    ` : '';

    html += `
      <div class="card-custom p-3 border position-relative horizontal-work-card mb-3" style="background: #FFFFFF;">
        <div class="d-flex flex-column flex-md-row gap-3 align-items-start">
          <!-- 橫式左側：原型縮圖預覽 -->
          <div class="work-thumbnail-box" style="background: ${thumbnailBg};" onclick="previewWork('${escapeHtml(w.id)}')" title="點擊即時預覽原型">
            <div class="work-thumbnail-browser-bar">
              <span class="work-thumbnail-dot"></span>
              <span class="work-thumbnail-dot"></span>
              <span class="work-thumbnail-dot"></span>
              <span class="ms-1 small text-white-50" style="font-size: 0.65rem;">MVP Preview</span>
            </div>
            <div class="text-center py-2">
              <i class="${thumbnailIcon} work-thumbnail-icon"></i>
            </div>
            <div class="d-flex justify-content-between align-items-center mt-auto">
              <span class="badge bg-black bg-opacity-50 text-white font-monospace" style="font-size: 0.65rem;">${escapeHtml(w.category || 'MVP')}</span>
              <span class="text-white-50" style="font-size: 0.7rem;"><i class="fas fa-search-plus me-1"></i>預覽</span>
            </div>
          </div>

          <!-- 橫式右側：詳細專案資訊與操作 -->
          <div class="flex-grow-1 w-100">
            <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-2">
              <div>
                ${individualBadge}
                <span class="badge bg-primary me-1">${escapeHtml(w.category || '實務作品')}</span>
                <span class="badge bg-light text-secondary border">第 ${w.week || 6} 週</span>
                <h6 class="fw-bold text-dark mt-2 mb-1 fs-5">${escapeHtml(w.title || '未命名專案')}</h6>
                <div class="small text-muted">
                  <i class="fas fa-user-circle me-1"></i>${escapeHtml(w.student_id || '')} ${escapeHtml(w.student_name || '同學')}
                  <span class="mx-1">•</span>
                  <i class="fas fa-graduation-cap me-1"></i>${escapeHtml(w.team_name || '企管四系1甲')}
                  <span class="mx-1">•</span>
                  <i class="fas fa-clock me-1"></i>${escapeHtml(w.submitted_at || '')}
                </div>
              </div>
              <div class="d-flex align-items-center gap-2">
                ${scoreBadge}
                ${teacherGradeBtn}
              </div>
            </div>

            <div class="p-2 bg-light rounded-2 small text-dark mb-2">
              <strong><i class="fas fa-bullseye text-danger me-1"></i>創意痛點概念：</strong>
              ${escapeHtml(w.concept || '無說明')}
            </div>

            ${w.agent_used ? `
            <div class="small text-muted mb-2">
              <i class="fas fa-robot text-info me-1"></i><strong>協同 AI Agent：</strong> ${escapeHtml(w.agent_used)}
            </div>
            ` : ''}

            ${w.teacher_comment ? `
            <div class="p-2 rounded-2 small mb-2 border-start border-success border-3" style="background: #F0FDF4;">
              <strong class="text-success"><i class="fas fa-chalkboard-teacher me-1"></i>授課教師評語：</strong>
              <span class="text-secondary">${escapeHtml(w.teacher_comment)}</span>
            </div>
            ` : ''}

            <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 border-top pt-2 mt-2">
              <div class="small text-muted">
                ${w.file_name ? `<i class="fas fa-file-code me-1 text-primary"></i>${escapeHtml(w.file_name)}` : ''}
              </div>
              <div class="d-flex gap-2">
                ${isHtmlWork ? `
                  <button class="btn btn-sm btn-outline-primary" onclick="previewWork('${escapeHtml(w.id)}')">
                    <i class="fas fa-play-circle me-1"></i>即時預覽原型
                  </button>
                ` : `
                  <button class="btn btn-sm btn-outline-secondary" onclick="previewWork('${escapeHtml(w.id)}')">
                    <i class="fas fa-eye me-1"></i>查看企劃摘要
                  </button>
                `}
                ${w.live_url ? `
                  <a href="${escapeHtml(w.live_url)}" target="_blank" class="btn btn-sm btn-outline-success">
                    <i class="fas fa-external-link-alt me-1"></i>線上連結
                  </a>
                ` : ''}
                <button class="btn btn-sm btn-light border" onclick="downloadWorkFile('${escapeHtml(w.id)}')">
                  <i class="fas fa-download me-1"></i>導出
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function filterWorksDisplay(filter) {
  currentWorksFilter = filter;
  const btnAll = document.getElementById('btn-filter-all');
  const btnMine = document.getElementById('btn-filter-mine');

  if (filter === 'all') {
    if (btnAll) btnAll.classList.add('active');
    if (btnMine) btnMine.classList.remove('active');
  } else {
    if (btnAll) btnAll.classList.remove('active');
    if (btnMine) btnMine.classList.add('active');
  }
  renderStudentWorks();
}

async function handleProjectSubmit(e) {
  e.preventDefault();

  if (!userProfile || !userProfile.studentId) {
    alert('請先登記學號與姓名（或使用 Google 登入）再行繳交作業！');
    openModal('userProfileModal');
    return;
  }

  const weekSelect = document.getElementById('upload-week-select');
  const selectedOpt = weekSelect.options[weekSelect.selectedIndex];
  const week = parseInt(weekSelect.value, 10);
  const weekTitle = selectedOpt ? selectedOpt.getAttribute('data-title') || selectedOpt.text : `第 ${week} 週作業`;
  const title = document.getElementById('upload-title').value.trim();
  const category = document.getElementById('upload-category').value;
  const concept = document.getElementById('upload-concept').value.trim();
  const promptSummary = document.getElementById('upload-prompt-summary').value.trim();
  const liveUrl = document.getElementById('upload-live-url').value.trim();
  const fileInput = document.getElementById('upload-file-input');
  const file = fileInput.files && fileInput.files[0];

  const workId = 'WORK-' + Date.now();
  const nowStr = new Date().toLocaleString('zh-TW', { hour12: false });

  const newWork = {
    id: workId,
    uid: currentFirebaseUser ? currentFirebaseUser.uid : '',
    email: currentFirebaseUser ? currentFirebaseUser.email : '',
    student_id: userProfile.studentId,
    student_name: userProfile.name || '同學',
    team_name: '企管四系1甲',
    week: week,
    week_title: weekTitle,
    title: title,
    category: category,
    concept: concept,
    agent_used: 'Agentic AI 協同發想',
    prompt_summary: promptSummary,
    live_url: liveUrl,
    file_name: file ? file.name : '',
    html_content: '',
    thumbnail: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
    thumbnail_icon: 'fas fa-rocket',
    submitted_at: nowStr,
    score: null,
    teacher_comment: ''
  };

  const btn = document.getElementById('btn-submit-work');
  if (btn) btn.disabled = true;

  // 嘗試讀取檔案內容
  if (file) {
    try {
      if (file.name.endsWith('.html') || file.name.endsWith('.htm') || file.name.endsWith('.txt')) {
        newWork.html_content = await file.text();
      }
    } catch (err) {
      console.warn('讀取檔案內容失敗', err);
    }
  }

  // 1. 同步上傳至雲端 Firestore (若在線上且有 Firebase)
  if (firestoreDb) {
    try {
      await firestoreDb.collection('works').doc(workId).set({
        ...newWork,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      console.log('✅ 作業已成功同步至 Firebase 雲端資料庫');
    } catch (err) {
      console.warn('Firebase 寫入警告 (改用本機儲存):', err);
    }
  }

  // 2. 本地儲存與記憶體備份
  studentWorksData.unshift(newWork);
  try {
    const localWorks = JSON.parse(localStorage.getItem('vnu_submitted_works') || '[]');
    localWorks.unshift(newWork);
    localStorage.setItem('vnu_submitted_works', JSON.stringify(localWorks));
  } catch(e) {}

  renderStudentWorks();
  unlockBadge('badge_work_submitted');

  if (btn) btn.disabled = false;
  document.getElementById('project-upload-form').reset();
  alert(`🎉 恭喜【企管四系1甲】${userProfile.name} 同學！
作業《${title}》已成功上傳並同步至雲端展示廊！`);
}

function previewWork(workId) {
  const work = (studentWorksData || []).find(w => w.id === workId);
  if (!work) return;

  const modalTitle = document.getElementById('preview-modal-title');
  const modalBadge = document.getElementById('preview-modal-badge');
  const iframe = document.getElementById('preview-iframe');
  const textBox = document.getElementById('preview-text-box');
  const extLink = document.getElementById('preview-external-link');

  if (modalTitle) modalTitle.textContent = `${work.title} - ${work.student_name} (${work.student_id})`;
  if (modalBadge) modalBadge.textContent = work.category || '微型創業原型';

  if (extLink) {
    if (work.live_url) {
      extLink.href = work.live_url;
      extLink.style.display = 'inline-block';
    } else {
      extLink.style.display = 'none';
    }
  }

  const isHtml = (work.category && work.category.includes('HTML')) ||
                (work.file_name && (work.file_name.endsWith('.html') || work.file_name.endsWith('.htm'))) ||
                Boolean(work.html_content);

  if (isHtml) {
    if (textBox) textBox.style.display = 'none';
    if (iframe) {
      iframe.style.display = 'block';
      if (work.html_content) {
        iframe.srcdoc = work.html_content;
      } else if (work.file_url) {
        iframe.src = work.file_url;
      } else {
        // 內建模擬 Demo 頁
        iframe.srcdoc = `
          <!DOCTYPE html>
          <html lang="zh-TW">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${escapeHtml(work.title)}</title>
            <script src="https://cdn.tailwindcss.com"></script>
          </head>
          <body class="bg-gray-50 p-8 font-sans">
            <div class="max-w-2xl mx-auto bg-white rounded-xl shadow-md p-6 border">
              <span class="bg-indigo-100 text-indigo-800 text-xs font-semibold px-2.5 py-0.5 rounded">微型創業一頁式 MVP 原型</span>
              <h1 class="text-2xl font-bold text-gray-900 mt-2 mb-3">${escapeHtml(work.title)}</h1>
              <p class="text-gray-600 mb-4">${escapeHtml(work.concept)}</p>
              <div class="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-4">
                <h3 class="font-bold text-blue-900 text-sm mb-1">💡 提示詞歷程 (CLEAR 框架)：</h3>
                <p class="text-xs text-blue-800 font-mono">${escapeHtml(work.prompt_summary || '無紀錄')}</p>
              </div>
              <div class="border-t pt-4 flex justify-between items-center text-sm text-gray-500">
                <span>作者：${escapeHtml(work.student_name)} (${escapeHtml(work.student_id)})</span>
                <span>所屬組別：${escapeHtml(work.team_name)}</span>
              </div>
            </div>
          </body>
          </html>
        `;
      }
    }
  } else {
    // 企劃書或純文字
    if (iframe) iframe.style.display = 'none';
    if (textBox) {
      textBox.style.display = 'block';
      textBox.innerHTML = `
        <div class="card p-4 border-0">
          <div class="d-flex align-items-center gap-2 mb-3">
            <span class="badge bg-info text-dark">${escapeHtml(work.category)}</span>
            <span class="text-muted small">繳交時間：${escapeHtml(work.submitted_at)}</span>
          </div>
          <h4 class="fw-bold text-dark mb-3">${escapeHtml(work.title)}</h4>
          <div class="p-3 bg-light rounded-3 mb-3 border">
            <h6 class="fw-bold text-primary mb-2"><i class="fas fa-bullseye me-1"></i>創意核心概念與痛點描述</h6>
            <p class="text-muted mb-0">${escapeHtml(work.concept)}</p>
          </div>
          <div class="p-3 bg-light rounded-3 mb-3 border">
            <h6 class="fw-bold text-success mb-2"><i class="fas fa-terminal me-1"></i>AI Prompt 提問記錄</h6>
            <p class="text-muted small font-monospace mb-0">${escapeHtml(work.prompt_summary || '依循 CLEAR 提問法')}</p>
          </div>
          ${work.teacher_comment ? `
          <div class="p-3 bg-success-subtle rounded-3 border-start border-success border-4">
            <h6 class="fw-bold text-success mb-1"><i class="fas fa-star text-warning me-1"></i>教師回饋評語 (得分：${work.score} 分)</h6>
            <p class="text-dark mb-0">${escapeHtml(work.teacher_comment)}</p>
          </div>
          ` : ''}
        </div>
      `;
    }
  }

  openModal('workPreviewModal');
}

function downloadWorkFile(workId) {
  const work = (studentWorksData || []).find(w => w.id === workId);
  if (!work) return;

  if (work.html_content) {
    const blob = new Blob([work.html_content], { type: 'text/html;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = work.file_name || `${work.title}.html`;
    a.click();
    return;
  }

  if (work.file_url) {
    window.open(work.file_url, '_blank');
    return;
  }

  // 導出文字檔摘要
  const content = `========================================================
萬能科技大學 11501 創意發想與實踐 學生作品存檔
========================================================
專案標題：${work.title}
繳交週次：${work.week_title || work.week}
作品類別：${work.category}
學生學號：${work.student_id}
學生姓名：${work.student_name}
班級組別：${work.team_name}
繳交時間：${work.submitted_at}
線上連結：${work.live_url || '無'}

【創意發想與痛點洞察】
${work.concept}

【AI 協同與 Prompt 提問記錄】
${work.prompt_summary}

【教師審核回饋】
評分：${work.score || '審核中'}
評語：${work.teacher_comment || '尚無'}
========================================================
`;
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${work.student_id}_${work.title}.txt`;
  a.click();
}

function copyTeacherDemoPrompt() {
  const el = document.getElementById('teacher-demo-prompt');
  if (!el) return;
  const text = el.innerText || el.textContent;
  navigator.clipboard.writeText(text).then(() => {
    alert('✅ 已複製教師示範黃金 Prompt！可直接貼至 Gemini 或 ChatGPT 生成網頁。');
  }).catch(() => {
    alert('請手動選取並複製 Prompt 內容。');
  });
}

function copyClearTemplatePrompt() {
  const template = `【C - 背景情境】我們是萬能科大企管系學生，正在為【填寫您的專案主題】規劃微型創業專案，目標客群為【填寫目標受眾】。
【L - 限制條件】請使用繁體中文，生成單一 HTML 檔案，使用 Tailwind CSS CDN 與 FontAwesome 圖標，排版自適應手機瀏覽，主色調為【填寫品牌顏色】。
【E - 期望產出】包含：1. 吸睛的 Hero 主標題與行動呼籲按鈕；2. 三大核心痛點賣點卡片；3. 產品/服務方案與價格；4. 線上預約/訂購彈窗 (Modal)。
【A - 具體動作】請為我【撰寫並設計】一個完整、排版專業且可直接在瀏覽器雙擊執行的單檔案一頁式行銷網頁程式碼。
【R - 角色設定】假設你是兼具 10 年品牌企劃實戰經驗與前端產品設計背景的資深產品經理 (PM)。`;

  navigator.clipboard.writeText(template).then(() => {
    alert('✅ 已複製 CLEAR 提示詞提問萬用公式！填寫括號內容即可向 AI 提問。');
  }).catch(() => {
    alert('請至手冊表格中複製 CLEAR 提問範例。');
  });
}

function toggleAccordion(id) {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.style.display === 'none' || !el.style.display) {
    el.style.display = 'block';
  } else {
    el.style.display = 'none';
  }
}




/* ==========================================================================
   教師線上評分與成績匯出管理 (Teacher Dashboard)
   ========================================================================== */
function openTeacherGradeModal(workId) {
  const work = studentWorksData.find(w => w.id === workId);
  if (!work) return;

  document.getElementById('grade-work-id').value = work.id;
  document.getElementById('grade-work-title').textContent = `《${work.title}》（第 ${work.week || 6} 週：${work.category || '微型創業作品'}）`;
  document.getElementById('grade-student-info').textContent = `${work.student_id || ''} ${work.student_name || ''} (${work.team_name || '企管四系1甲'})`;
  document.getElementById('grade-work-concept').textContent = `痛點概念：${work.concept || '無說明'}`;
  document.getElementById('grade-score-input').value = (work.score !== null && work.score !== undefined) ? work.score : 90;
  document.getElementById('grade-comment-input').value = work.teacher_comment || '痛點洞察深刻，AI 協同實踐完整！';

  openModal('teacherGradingModal');
}

async function saveTeacherGrade() {
  const workId = document.getElementById('grade-work-id').value;
  const scoreVal = document.getElementById('grade-score-input').value;
  const commentVal = document.getElementById('grade-comment-input').value.trim();

  if (scoreVal === '' || isNaN(scoreVal) || Number(scoreVal) < 0 || Number(scoreVal) > 100) {
    alert('請輸入 0 ~ 100 之間的分數！');
    return;
  }

  const scoreNum = Number(scoreVal);
  const work = studentWorksData.find(w => w.id === workId);
  if (work) {
    work.score = scoreNum;
    work.teacher_comment = commentVal;
  }

  // 同步至 Firestore
  if (firestoreDb) {
    try {
      await firestoreDb.collection('works').doc(workId).update({
        score: scoreNum,
        teacher_comment: commentVal,
        graded_at: new Date().toLocaleString('zh-TW', { hour12: false })
      });
      console.log('✅ 教師評分已同步至雲端 Firestore');
    } catch (e) {
      console.warn('Firestore grade update notice:', e);
    }
  }

  // 同步本機快取
  try {
    const localWorks = JSON.parse(localStorage.getItem('vnu_submitted_works') || '[]');
    const target = localWorks.find(w => w.id === workId);
    if (target) {
      target.score = scoreNum;
      target.teacher_comment = commentVal;
      localStorage.setItem('vnu_submitted_works', JSON.stringify(localWorks));
    }
  } catch (e) {}

  renderStudentWorks();
  closeModal('teacherGradingModal');
  alert(`✅ 評分儲存成功！已為同學送出評分：${scoreNum} 分與指導評語。`);
}

function exportGradesToCSV() {
  if (!studentWorksData || studentWorksData.length === 0) {
    alert('目前尚無任何學生作業資料可供匯出。');
    return;
  }

  const headers = ['學號', '姓名', '班級', 'Google信箱', '週次', '專案標題', '作品類別', '創意痛點洞察', 'AI提示詞摘要', '線上網址', '評分', '教師評語', '繳交時間'];
  
  const csvRows = [];
  csvRows.push(headers.join(','));

  studentWorksData.forEach(w => {
    const row = [
      `"${(w.student_id || '').replace(/"/g, '""')}"`,
      `"${(w.student_name || '').replace(/"/g, '""')}"`,
      `"${(w.team_name || '企管四系1甲').replace(/"/g, '""')}"`,
      `"${(w.email || '').replace(/"/g, '""')}"`,
      `"第 ${w.week || 6} 週"`,
      `"${(w.title || '').replace(/"/g, '""')}"`,
      `"${(w.category || '').replace(/"/g, '""')}"`,
      `"${(w.concept || '').replace(/\n/g, ' ').replace(/"/g, '""')}"`,
      `"${(w.prompt_summary || '').replace(/\n/g, ' ').replace(/"/g, '""')}"`,
      `"${(w.live_url || '').replace(/"/g, '""')}"`,
      `"${(w.score !== null && w.score !== undefined) ? w.score : '未評分'}"`,
      `"${(w.teacher_comment || '').replace(/\n/g, ' ').replace(/"/g, '""')}"`,
      `"${(w.submitted_at || '').replace(/"/g, '""')}"`
    ];
    csvRows.push(row.join(','));
  });

  const csvContent = '\uFEFF' + csvRows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `11501_創意發想與實踐_全班作業成績表_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 明確將關鍵操作函式綁定至 window 全域，避免各類封裝環境之作用域問題
window.initFirebase = initFirebase;
window.loginWithGoogle = loginWithGoogle;
window.logoutUser = logoutUser;
window.openModal = openModal;
window.closeModal = closeModal;
window.switchTab = switchTab;
window.saveUserProfile = saveUserProfile;
window.exportGradesToCSV = exportGradesToCSV;
window.openTeacherGradeModal = openTeacherGradeModal;
window.closeTeacherGradeModal = closeTeacherGradeModal;
window.saveTeacherGrade = saveTeacherGrade;
window.previewWork = previewWork;

