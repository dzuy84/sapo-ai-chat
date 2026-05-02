<div id="rona-chat-system">
    <div id="ai-btn"><span>🍷</span> <span class="ai-btn-text">TƯ VẤN</span></div>
    <div id="ai-box">
      <div id="ai-header">✨ RONA - Chuyên Gia</div>
      <div id="ai-msg"></div>
      <div id="ai-loading" style="display:none; padding: 5px;"><div class="msg-ai" style="font-style: italic; color: #888; font-size: 9px;">Duy đang tìm...</div></div>
      <div id="ai-input">
        <input id="ai-text" placeholder="Hỏi Duy..." autocomplete="off" />
        <button id="ai-send-btn">></button>
      </div>
    </div>
</div>

<style>
#rona-chat-system { all: initial; font-family: sans-serif; }
#ai-btn { position: fixed; bottom: 80px; right: 15px; background: rgba(139, 0, 0, 0.8); backdrop-filter: blur(10px); color: #fff; padding: 6px 14px; border-radius: 30px; cursor: pointer; z-index: 9999999; display: flex; align-items: center; gap: 5px; font-weight: bold; font-size: 11px; min-width: 85px; white-space: nowrap; box-shadow: 0 4px 15px rgba(0,0,0,0.2); }
#ai-box { position: fixed; bottom: 125px; right: 15px; width: 220px; height: 320px; background: rgba(255, 255, 255, 0.4); backdrop-filter: blur(25px) saturate(180%); -webkit-backdrop-filter: blur(25px) saturate(180%); border-radius: 15px; border: 1px solid rgba(255, 255, 255, 0.4); box-shadow: 0 10px 40px rgba(0,0,0,0.1); display: none; flex-direction: column; z-index: 9999999; overflow: hidden; }
#ai-header { background: rgba(139, 0, 0, 0.7); color: #fff; padding: 7px; font-weight: bold; text-align: center; font-size: 11px; }
#ai-msg { flex: 1; padding: 10px; overflow-y: auto; background: transparent; scroll-behavior: smooth; }
.msg-user { text-align: right; margin-bottom: 8px; }
.msg-user span { background: #8b0000; color: #fff; padding: 5px 10px; border-radius: 12px 12px 2px 12px; display: inline-block; font-size: 10.5px; }
.msg-ai { margin-bottom: 8px; background: rgba(255, 255, 255, 0.3); color: #111; padding: 8px; border-radius: 12px 12px 12px 2px; font-size: 10.5px; border-left: 3px solid #8b0000; line-height: 1.4; text-align: left; }
.msg-ai a { color: #8b0000 !important; font-weight: bold; text-decoration: underline; }

/* Nút loa đọc chữ */
.speak-btn { cursor: pointer; display: inline-block; margin-left: 8px; font-size: 13px; color: #8b0000; vertical-align: middle; padding: 2px; }

#ai-input { display: flex; border-top: 1px solid rgba(0,0,0,0.05); padding: 5px; background: rgba(255, 255, 255, 0.2); }
#ai-input input { flex: 1; padding: 5px 12px; border: 1px solid rgba(255, 255, 255, 0.3); outline: none; font-size: 10.5px; border-radius: 20px; background: rgba(255, 255, 255, 0.5); }
#ai-input button { background: #8b0000; color: #fff; border: none; width: 26px; height: 26px; border-radius: 50%; cursor: pointer; margin-left: 5px; display: flex; align-items: center; justify-content: center; }
</style>

<script>
(function() {
  const init = () => {
    const btn = document.getElementById("ai-btn"), box = document.getElementById("ai-box"), input = document.getElementById("ai-text"), msgBox = document.getElementById("ai-msg"), loading = document.getElementById("ai-loading"), sendBtn = document.getElementById("ai-send-btn");
    if(!btn) return;

    // HÀM ĐỌC GIỌNG NAM VIỆT NAM
    window.speakRona = (text) => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const speech = new SpeechSynthesisUtterance(text);
            const voices = window.speechSynthesis.getVoices();
            // Chọn giọng nam (Male) tiếng Việt hoặc tiếng Anh tùy câu hỏi
            let selectedVoice = voices.find(v => v.lang.includes('vi') && (v.name.includes('Male') || v.name.includes('Google')));
            if (!selectedVoice) selectedVoice = voices.find(v => v.lang.includes('vi'));
            
            speech.voice = selectedVoice;
            speech.rate = 1.0; 
            speech.pitch = 0.85; // Hạ pitch xuống 0.85 để giọng trầm ấm, nam tính
            window.speechSynthesis.speak(speech);
        }
    };

    btn.onclick = () => { 
        const isHidden = (box.style.display === "none" || box.style.display === "");
        box.style.display = isHidden ? "flex" : "none";
        if(isHidden) input.focus();
    };

    async function sendAI() {
      const text = input.value.trim(); if (!text) return;
      msgBox.innerHTML += `<div class="msg-user"><span>${text}</span></div>`;
      input.value = ""; loading.style.display = "block";
      try {
        const res = await fetch("https://sapo-ai-chat.vercel.app/api/chat", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, context: document.title })
        });
        const data = await res.json();
        loading.style.display = "none";
        
        // Tạo đoạn text sạch để đọc (không bao gồm link html)
        const cleanText = data.reply.replace(/<[^>]*>/g, '').replace(/'/g, "\\'");
        
        // Thêm tin nhắn và nút loa 🔊
        msgBox.innerHTML += `<div class="msg-ai">${data.reply} <span class="speak-btn" title="Nghe Duy đọc" onclick="speakRona('${cleanText}')">🔊</span></div>`;
        
        localStorage.setItem("rona_chat_history", msgBox.innerHTML);
      } catch (err) { loading.style.display = "none"; }
      msgBox.scrollTop = msgBox.scrollHeight;
    };

    sendBtn.onclick = sendAI;
    input.onkeypress = (e) => { if (e.key === "Enter") sendAI(); };
    
    const history = localStorage.getItem("rona_chat_history");
    msgBox.innerHTML = history || `<div class="msg-ai">Duy chào mình ạ! Duy có thể giúp gì cho mình không? ✨</div>`;
    msgBox.scrollTop = msgBox.scrollHeight;
  };
  window.addEventListener("load", init);
  window.speechSynthesis.getVoices(); // Khởi tạo giọng nói
})();
</script>
