{% assign info = settings.fot_info %}
{% assign social = settings.fot_social %}
{% assign c1_title = settings.fot_c1_title %}
{% assign c1_menu = settings.fot_menu1 %}
{% assign c2_title = settings.fot_c2_title %}
{% assign c2_menu = settings.fot_menu2 %}
{% assign c3_title = settings.fot_c3_title %}
{% assign c3_menu = settings.fot_menu3 %}
{% assign c4_title = settings.fot_c4_title %}
{% assign c4_menu = settings.fot_menu4 %}
{% assign coppyright = settings.coppyright %}
{% assign btt = settings.backtotop_enable %}

<footer class="footer-container">
    <div class="footer-top">
        <div class="container">
            <div class="footer-static">
                <div class="row">
                    <div class="f-col f-col1 col-md-4 col-sm-12 col-xs-12">
                        <div class="logo-footer">
                            <a href="/">
                                <img src="{{ 'logo.png' | asset_url }}" alt="{{ store.name }}" class="img-responsive" width="350" height="93" loading="eager" />
                            </a>
                        </div>
                        <div class="footer-content">
                            <ul class="info">
                                {% if settings.store_edit %}
                                <li><b>Địa chỉ</b>: {{ settings.store_address }}<a class="link-map" href="{{settings.store_address_map}}" target="_blank"> [Xem bản đồ]</a></li>
                                {% if settings.store_address2 != null and settings.store_address2 != '' %}
                                <li><b>Showroom</b>: {{ settings.store_address2 }}<a class="link-map" href="{{settings.store_address_map2}}" target="_blank"> [Xem bản đồ]</a></li>
                                {% endif %}
                                <li><b>Điện thoại</b>: <a href="tel:{{ settings.store_phone | remove: ' '}}">{{ settings.store_phone }}</a></li>
                                <li><b>Website</b>: <a href="{{ settings.store_web }}">{{ settings.store_web }}</a></li>
                                <li><b>Email</b>: <a href="mailto:{{ settings.store_email }}">{{ settings.store_email }}</a></li>
                                {% else %}
                                <li><b>Địa chỉ</b>: {{ store.address }}, {{ store.province }}</li>
                                <li><b>Điện thoại</b>: <a href="tel:{{ store.phone_number | remove: ' '}}">{{ store.phone_number }}</a></li>
                                <li><b>Website</b>: <a href="https:{{ store.url }}">https:{{ store.url }}</a></li>
                                <li><b>Email</b>: <a href="mailto:{{ store.customer_email }}">{{ store.customer_email }}</a></li>
                                {% endif %}
                            </ul>
                            <div class="social-icons">
                                <ul>
                                    {% if settings.social_twitter_enable %}<li class="twitter"><a title="twitter" href="{{ settings.social_twitter_link }}" target="_blank" rel="noopener noreferrer"><i class="fa-twitter fa"></i></a></li>{% endif %}
                                    {% if settings.social_facebook_enable %}<li class="facebook"><a title="facebook" href="{{ settings.social_facebook_link }}" target="_blank" rel="noopener noreferrer"><i class="fa-facebook fa"></i></a></li>{% endif %}
                                    {% if settings.social_youtube_enable %}<li class="googleplus"><a title="Youtube" href="{{ settings.social_youtube_link }}" target="_blank" rel="noopener noreferrer"><i class="fa-youtube fa"></i></a></li>{% endif %}
                                    {% if settings.social_pinterest_enable %}<li class="youtube"><a title="Pinterest" href="{{ settings.social_pinterest_link }}" target="_blank" rel="noopener noreferrer"><i class="fa fa-pinterest-p"></i></a></li>{% endif %}
                                    {% if settings.social_instagram_enable %}<li class="pinterest"><a title="pinterest" href="{{ settings.social_instagram_link }}" target="_blank" rel="noopener noreferrer"><i class="fa-instagram"></i></a></li>{% endif %}
                                </ul>
                            </div>
                        </div>
                    </div>
                    <div class="f-col f-col2 col-md-2 col-sm-6 col-xs-6">
                        <div class="footer-title"><h3>{{c2_title}}</h3></div>
                        <div class="footer-content">
                            <ul class="menu">
                                {% for link in linklists[c2_menu].links %}<li><a href="{{ link.url }}">{{ link.title }}</a></li>{% endfor %}
                            </ul>
                        </div>
                    </div>
                    <div class="f-col f-col3 col-md-2 col-sm-6 col-xs-6">
                        <div class="footer-title"><h3>{{c3_title}}</h3></div>
                        <div class="footer-content">
                            <ul class="menu">
                                {% for link in linklists[c3_menu].links %}<li><a href="{{ link.url }}">{{ link.title }}</a></li>{% endfor %}
                            </ul>
                        </div>
                    </div>
                    <div class="f-col f-col4 col-md-4 col-sm-12 col-xs-12">
                        <div class="footer-title"><h3>{{c4_title}}</h3></div>
                        <div class="footer-content">
                            <div class="content">
                                <div class="footer-facebook-link">
                                    <a href="https://www.facebook.com/lyuongruouvangvn/" target="_blank" rel="noopener noreferrer">
                                        <img src="https://bizweb.dktcdn.net/thumb/grande/100/371/914/products/1000044447.jpg?v=1763951288950" alt="Fanpage Bohemia" class="img-responsive center-block" style="width: 100%; max-width: 350px;" loading="lazy" />
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div> 

    <div class="footer-bottom">
        <div class="container">
            <div class="row">
                <div class="col-md-6">
                    <div class="footer-copyright">
                        <small class="copyright">
                            {% if coppyright != null %}<span>{{coppyright}} | Cung cấp bởi <a href="https://lyuongruouvang.com">lyuongruouvang</a></span>
                            {% else %}<span>© Bản quyền thuộc về Bohemia & Rona</span>{% endif %}
                        </small>
                    </div>
                </div>
                <div class="col-md-6 text-right">
                    <div class="payment"><img src="{{ 'payment.png' | asset_url }}" alt="Payment" loading="lazy"></div>
                </div>
            </div> 
        </div> 
        {% if btt %}<div class="back-to-top"><i class="fa fa-angle-double-up"></i></div>{% endif %}
    </div>
</footer>

<div id="rona-ai-container">
    <div id="ai-btn-rona">🍷 Tư vấn AI</div>
    <div id="ai-box-rona">
        <div id="ai-header-rona">
            <span>✨ RONA Expert</span>
            <span id="ai-close-rona" style="cursor:pointer; font-size:22px;">×</span>
        </div>
        <div id="ai-msg-rona"></div>
        <div id="ai-loading-rona" style="display:none; padding:10px; font-size:12px; color:#8b0000; background:transparent; border-top:1px solid rgba(255,255,255,0.3);">RONA đang xử lý...</div>
        <div id="ai-input-rona">
            <input id="ai-text-rona" type="text" placeholder="Hỏi Rona về ly, cốc pha lê..." autocomplete="off" />
            <button id="ai-send-rona">Gửi</button>
        </div>
    </div>
</div>

<style>
/* CSS NÂNG CẤP HIỆU ỨNG GLASS & THU NHỎ KÍCH THƯỚC */
#ai-btn-rona { position: fixed !important; bottom: 85px !important; right: 20px !important; background: #8b0000 !important; color: #fff !important; padding: 12px 22px !important; border-radius: 30px !important; cursor: pointer !important; z-index: 2147483647 !important; font-weight: bold !important; box-shadow: 0 4px 15px rgba(0,0,0,0.3) !important; }

/* Thu nhỏ thành 300x420, Thêm Glassmorphism */
#ai-box-rona { position: fixed !important; bottom: 150px !important; right: 20px !important; width: 300px !important; height: 420px !important; background: rgba(255, 255, 255, 0.65) !important; backdrop-filter: blur(15px) !important; -webkit-backdrop-filter: blur(15px) !important; border: 1px solid rgba(255, 255, 255, 0.6) !important; display: none; flex-direction: column !important; z-index: 2147483647 !important; border-radius: 15px !important; overflow: hidden !important; box-shadow: 0 10px 40px rgba(0,0,0,0.2) !important; font-family: Arial, sans-serif !important; }

/* Header mờ ảo sang trọng */
#ai-header-rona { background: rgba(139, 0, 0, 0.85) !important; color: #fff !important; padding: 12px 15px !important; display: flex; justify-content: space-between; align-items: center; font-weight: bold; border-bottom: 1px solid rgba(255,255,255,0.2); }

/* Nền trong suốt để lộ lớp kính */
#ai-msg-rona { flex: 1 !important; padding: 15px !important; overflow-y: auto !important; font-size: 14px !important; background: transparent !important; }

/* Vùng nhập liệu */
#ai-input-rona { display: flex !important; padding: 10px !important; border-top: 1px solid rgba(255, 255, 255, 0.5) !important; background: rgba(255, 255, 255, 0.3) !important; }
#ai-text-rona { flex: 1 !important; border: 1px solid rgba(255, 255, 255, 0.8) !important; background: rgba(255, 255, 255, 0.7) !important; padding: 8px 12px !important; border-radius: 20px !important; outline: none !important; font-size: 13px !important; color: #333 !important; }
#ai-text-rona::placeholder { color: #777 !important; }
#ai-send-rona { background: #8b0000 !important; color: #fff !important; border: none !important; margin-left: 8px !important; padding: 0 15px !important; border-radius: 20px !important; cursor: pointer !important; font-weight: bold; box-shadow: 0 2px 8px rgba(139,0,0,0.3) !important;}

/* Tin nhắn của khách */
.msg-u { text-align: right; margin-bottom: 15px; }
.msg-u span { background: rgba(139, 0, 0, 0.9) !important; color: #fff !important; padding: 8px 14px !important; border-radius: 15px 15px 0 15px !important; display: inline-block; max-width: 85%; box-shadow: 0 2px 8px rgba(0,0,0,0.1) !important;}

/* Bong bóng AI dạng Glass sáng */
.msg-a { background: rgba(255, 255, 255, 0.85) !important; backdrop-filter: blur(5px) !important; border: 1px solid rgba(255, 255, 255, 0.8) !important; color: #333 !important; padding: 12px 14px !important; border-radius: 15px 15px 15px 0 !important; margin-bottom: 15px; line-height: 1.6 !important; max-width: 92%; font-size: 13px; position: relative; box-shadow: 0 4px 15px rgba(0,0,0,0.05) !important; }
.msg-a a { display: block !important; margin-top: 10px !important; padding: 10px !important; background: rgba(255, 255, 255, 0.9) !important; color: #8b0000 !important; border: 1px solid rgba(139, 0, 0, 0.2) !important; border-radius: 8px !important; text-decoration: none !important; font-weight: bold !important; text-align: center; }
.voice-btn { display: inline-block; font-size: 11px; color: #8b0000; margin-top: 8px; cursor: pointer; font-weight: bold; border: 1px dashed rgba(139, 0, 0, 0.5); padding: 3px 10px; border-radius: 12px; background: rgba(255, 255, 255, 0.6) !important; }
</style>

<script>
let chatHistory = []; 

document.addEventListener("DOMContentLoaded", function() {
    const box = document.getElementById("ai-box-rona");
    const msgBox = document.getElementById("ai-msg-rona");
    const input = document.getElementById("ai-text-rona");
    const loading = document.getElementById("ai-loading-rona");

    // Khôi phục lịch sử chat cũ nếu có
    const savedChat = localStorage.getItem("rona_chat_history_vfinal");
    if (savedChat) {
        msgBox.innerHTML = savedChat;
        setTimeout(() => { msgBox.scrollTop = msgBox.scrollHeight; }, 300);
    }

    document.getElementById("ai-btn-rona").onclick = () => {
        box.style.display = (box.style.display === 'flex') ? 'none' : 'flex';
        msgBox.scrollTop = msgBox.scrollHeight;
    };
    document.getElementById("ai-close-rona").onclick = () => { box.style.display = 'none'; };

    function formatAIResponse(text) {
        if (!text) return "";
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, "<br>")
            .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_self">🛍️ Xem ngay: $1</a>');
    }

    window.speakRona = function(el, text) {
        if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
            el.innerText = "🔊 Nghe lại";
            return;
        }
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "vi-VN";
        u.onstart = () => el.innerText = "🛑 Dừng đọc";
        u.onend = () => el.innerText = "🔊 Nghe lại";
        window.speechSynthesis.speak(u);
    };

    async function handleSend() {
        const text = input.value.trim();
        if (!text) return;

        // Lấy ngữ cảnh sản phẩm từ trang web
        const productName = document.querySelector('h1')?.innerText || document.title;
        const productPrice = document.querySelector('.product-price')?.innerText || "";
        const productDesc = document.querySelector('.product-description')?.innerText || "";
        const fullContext = `Sản phẩm đang xem: ${productName}. Giá: ${productPrice}. Mô tả sơ lược: ${productDesc.substring(0, 500)}`;

        msgBox.innerHTML += `<div class="msg-u"><span>${text}</span></div>`;
        input.value = "";
        loading.style.display = "block";
        msgBox.scrollTop = msgBox.scrollHeight;

        try {
            // ĐÃ ĐỔI SANG LINK VERCEL CHUẨN CỦA SẾP
            const res = await fetch("https://sapo-ai-chat-vdwf.vercel.app/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    message: text,
                    history: chatHistory,
                    context: fullContext 
                })
            });
            
            if (!res.ok) throw new Error("Server Error");

            const data = await res.json();
            loading.style.display = "none";
            
            chatHistory.push({ role: "user", content: text });
            chatHistory.push({ role: "assistant", content: data.reply });
            if (chatHistory.length > 6) chatHistory.splice(0, 2);

            let htmlReply = formatAIResponse(data.reply);
            let speechText = data.reply.replace(/\[.*?\]\(.*?\)/g, '').replace(/<[^>]*>?/gm, '');

            msgBox.innerHTML += `
                <div class="msg-a">
                    ${htmlReply}
                    <div style="text-align:right">
                        <span class="voice-btn" onclick="speakRona(this, \`${speechText.replace(/`/g, "'").replace(/"/g, '')}\`)">🔊 Nghe tư vấn</span>
                    </div>
                </div>`;
            
            localStorage.setItem("rona_chat_history_vfinal", msgBox.innerHTML);
            setTimeout(() => { msgBox.scrollTop = msgBox.scrollHeight; }, 100);
        } catch (err) {
            loading.style.display = "none";
            msgBox.innerHTML += `<div class="msg-a">Hương Lan đang bận một chút, Duy nhắn lại sau 1 phút nhé!</div>`;
            msgBox.scrollTop = msgBox.scrollHeight;
        }
    }

    document.getElementById("ai-send-rona").onclick = handleSend;
    input.onkeypress = (e) => { if(e.key === 'Enter') handleSend(); };
});
</script>
