/*!
 * LiquidVideoPlayer
 * Video player tuỳ biến với control bar hiệu ứng "kính lỏng" (LiquidGlass WebGL).
 * Nhúng vào trang bất kỳ, hỗ trợ nhiều player cùng lúc trên 1 trang.
 *
 * Dùng nhanh:
 *   <div id="my-player"></div>
 *   <script src="liquid-video-player.js"></script>
 *   <script>
 *     new LiquidVideoPlayer('#my-player', { src: 'video.mp4' });
 *   </script>
 *
 * Xem đầy đủ tuỳ chọn ở DEFAULTS bên dưới.
 */
(function (global) {
	'use strict';

	const ICON_FONT_URL = 'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css';
	const LIQUID_GLASS_URL = 'https://cdn.jsdelivr.net/npm/@ybouane/liquidglass/dist/index.js';

	const DEFAULTS = {
		src: '',              // đường dẫn video (bắt buộc)
		poster: '',            // ảnh poster (tuỳ chọn)
		loop: true,
		muted: false,
		autoplay: false,
		playsinline: true,
		speeds: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
		idleHideMs: 2500,      // thời gian (ms) chuột đứng yên trước khi tự ẩn control
		// Tham số truyền cho LiquidGlass — xem thư viện @ybouane/liquidglass
		cornerRadius: 20,
		zRadius: 10,
		blurAmount: 0.1,
		brightness: -0.1,
	};

	// ── CSS dùng chung cho mọi instance, chỉ inject 1 lần vào <head> ──
	const CSS_TEXT = `
.lvp-wrap {
	position: relative;
	width: 100%;
	aspect-ratio: 16 / 9;
	font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
}
.lvp-wrap, .lvp-wrap *, .lvp-wrap *::before, .lvp-wrap *::after {
	box-sizing: border-box;
}
.lvp-video {
	width: 100%;
	height: 100%;
	object-fit: cover;
	display: block;
	border-radius: 16px;
	background: #000;
}

.lvp-big-play {
	position: absolute;
	inset: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgba(0,0,0,0.25);
	border: none;
	cursor: pointer;
	padding: 0;
	margin: 0;
	z-index: 2;
	opacity: 1;
	transition: opacity .25s ease;
	color: #fff;
}
.lvp-big-play i {
	font-size: 60px;
	line-height: 1;
	filter: drop-shadow(0 4px 18px rgba(0,0,0,0.5));
}
.lvp-wrap.lvp-playing .lvp-big-play {
	opacity: 0;
	pointer-events: none;
}

.lvp-ctrl {
	position: absolute;
	bottom: 8px;
	left: 8px;
	right: 8px;
	display: flex;
	align-items: center;
	padding: 10px 16px;
	color: #fff;
	z-index: 3;
	opacity: 1;
	transition: opacity .25s ease;
}
.lvp-wrap.lvp-hidden .lvp-ctrl {
	opacity: 0;
	pointer-events: none;
}
.lvp-wrap.lvp-hidden .lvp-video {
	cursor: none;
}
.lvp-ctrl .lvp-label {
	position: relative;
	z-index: 2;
	pointer-events: none;
	display: flex;
	align-items: center;
	gap: 12px;
	width: 100%;
}

.lvp-play-btn, .lvp-mute-btn, .lvp-fullscreen-btn, .lvp-speed-btn {
	background: none;
	border: none;
	color: #fff;
	cursor: pointer;
	line-height: 1;
	pointer-events: auto;
	flex-shrink: 0;
	display: flex;
	align-items: center;
	padding: 0;
}
.lvp-play-btn i { font-size: 22px; line-height: 1; }
.lvp-mute-btn i, .lvp-fullscreen-btn i, .lvp-speed-btn i { font-size: 19px; line-height: 1; }

.lvp-speed-wrap {
	position: relative;
	pointer-events: auto;
	flex-shrink: 0;
	display: flex;
	align-items: center;
}

.lvp-speed-menu {
	position: absolute;
	bottom: calc(100% + 10px);
	right: -8px;
	display: none;
	flex-direction: column;
	background: rgba(20,20,22,0.22);
	backdrop-filter: blur(8px) saturate(140%);
	-webkit-backdrop-filter: blur(8px) saturate(140%);
	border: 1px solid rgba(255,255,255,0.08);
	border-radius: 12px;
	padding: 6px;
	min-width: 96px;
	box-shadow: 0 10px 30px rgba(0,0,0,0.25);
	z-index: 10;
}
.lvp-speed-menu.lvp-open { display: flex; }
.lvp-speed-item {
	background: none;
	border: none;
	color: rgba(255,255,255,0.85);
	font-size: 13px;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 14px;
	padding: 7px 10px;
	border-radius: 8px;
	cursor: pointer;
	white-space: nowrap;
}
.lvp-speed-item:hover {
	background: rgba(255,255,255,0.12);
	color: #fff;
}
.lvp-speed-item.lvp-active {
	color: #fff;
	font-weight: 600;
	background: rgba(255,255,255,0.14);
}
.lvp-speed-check {
	font-size: 14px;
	opacity: 0;
}
.lvp-speed-item.lvp-active .lvp-speed-check {
	opacity: 1;
}

.lvp-wrap:-webkit-full-screen,
.lvp-wrap:-moz-full-screen,
.lvp-wrap:fullscreen {
	width: 100vw;
	height: 100vh;
	max-width: none;
	background: #000;
}
.lvp-wrap:-webkit-full-screen .lvp-video,
.lvp-wrap:-moz-full-screen .lvp-video,
.lvp-wrap:fullscreen .lvp-video {
	border-radius: 0;
}

.lvp-progress {
	flex: 1;
	height: 6px;
	background: rgba(255,255,255,0.25);
	border-radius: 3px;
	cursor: pointer;
	pointer-events: auto;
	position: relative;
	overflow: hidden;
}
.lvp-progress-fill {
	position: absolute;
	top: 0; left: 0; bottom: 0;
	width: 0%;
	background: #fff;
	border-radius: 3px;
}

.lvp-time {
	font-size: 12px;
	font-variant-numeric: tabular-nums;
	color: rgba(255,255,255,0.85);
	text-align: right;
	flex-shrink: 0;
	pointer-events: none;
	white-space: nowrap;
}
`;

	// ── HTML khung của 1 player, không dùng id để tránh đụng giữa các instance ──
	function buildSpeedItemsHTML(speeds) {
		return speeds.map((s, i) => {
			const label = (s % 1 === 0 ? s.toFixed(0) : s) + 'x';
			const active = s === 1 ? ' lvp-active' : '';
			return `<button class="lvp-speed-item${active}" data-speed="${s}" role="menuitem"><span>${label}</span><i class="ti ti-check lvp-speed-check"></i></button>`;
		}).join('');
	}

	function buildMarkup(opts) {
		return `
<video class="lvp-video"${opts.loop ? ' loop' : ''}${opts.muted ? ' muted' : ''}${opts.playsinline ? ' playsinline' : ''}${opts.poster ? ` poster="${opts.poster}"` : ''} src="${opts.src}"></video>
<button class="lvp-big-play" aria-label="Phát video" type="button">
	<i class="ti ti-player-play"></i>
</button>
<div class="lvp-ctrl">
	<span class="lvp-label">
		<button class="lvp-play-btn" type="button"><i class="ti ti-player-pause lvp-play-icon"></i></button>
		<button class="lvp-mute-btn" type="button"><i class="ti ti-volume lvp-mute-icon"></i></button>
		<div class="lvp-progress">
			<div class="lvp-progress-fill"></div>
		</div>
		<span class="lvp-time">0:00</span>
		<div class="lvp-speed-wrap">
			<button class="lvp-speed-btn" type="button" aria-haspopup="true" aria-expanded="false" aria-label="Tốc độ phát"><i class="ti ti-gauge"></i></button>
			<div class="lvp-speed-menu" role="menu">${buildSpeedItemsHTML(opts.speeds)}</div>
		</div>
		<button class="lvp-fullscreen-btn" type="button"><i class="ti ti-maximize lvp-fullscreen-icon"></i></button>
	</span>
</div>`;
	}

	function formatTime(secs) {
		if (!isFinite(secs)) return '0:00';
		const m = Math.floor(secs / 60);
		const s = Math.floor(secs % 60);
		return m + ':' + (s < 10 ? '0' + s : s);
	}

	// ── Inject CSS + icon font 1 lần duy nhất cho cả trang ──
	let stylesInjected = false;
	function ensureStyles() {
		if (stylesInjected) return;
		stylesInjected = true;
		if (!document.querySelector('link[data-lvp-icons]')) {
			const link = document.createElement('link');
			link.rel = 'stylesheet';
			link.href = ICON_FONT_URL;
			link.setAttribute('data-lvp-icons', '');
			document.head.appendChild(link);
		}
		if (!document.querySelector('style[data-lvp-styles]')) {
			const style = document.createElement('style');
			style.setAttribute('data-lvp-styles', '');
			style.textContent = CSS_TEXT;
			document.head.appendChild(style);
		}
	}

	// ── LiquidGlass là ES module, load 1 lần rồi tái sử dụng cho mọi instance ──
	let liquidGlassPromise = null;
	function loadLiquidGlass() {
		if (!liquidGlassPromise) {
			liquidGlassPromise = import(LIQUID_GLASS_URL).then((m) => m.LiquidGlass);
		}
		return liquidGlassPromise;
	}

	class LiquidVideoPlayer {
		constructor(target, options) {
			this.options = Object.assign({}, DEFAULTS, options || {});

			this.container = typeof target === 'string' ? document.querySelector(target) : target;
			if (!this.container) {
				throw new Error('LiquidVideoPlayer: không tìm thấy phần tử "' + target + '"');
			}

			ensureStyles();
			this._build();
			this._bindEvents();
			this._initGlass();
		}

		_build() {
			const o = this.options;
			const wrap = document.createElement('div');
			wrap.className = 'lvp-wrap';
			wrap.setAttribute('data-dynamic', '');
			wrap.innerHTML = buildMarkup(o);

			this.container.innerHTML = '';
			this.container.appendChild(wrap);

			this.wrap = wrap;
			this.video = wrap.querySelector('.lvp-video');
			this.bigPlayBtn = wrap.querySelector('.lvp-big-play');
			this.ctrlEl = wrap.querySelector('.lvp-ctrl');
			this.playBtn = wrap.querySelector('.lvp-play-btn');
			this.playIcon = wrap.querySelector('.lvp-play-icon');
			this.muteBtn = wrap.querySelector('.lvp-mute-btn');
			this.muteIcon = wrap.querySelector('.lvp-mute-icon');
			this.progress = wrap.querySelector('.lvp-progress');
			this.fill = wrap.querySelector('.lvp-progress-fill');
			this.timeLabel = wrap.querySelector('.lvp-time');
			this.fsBtn = wrap.querySelector('.lvp-fullscreen-btn');
			this.fsIcon = wrap.querySelector('.lvp-fullscreen-icon');
			this.speedWrap = wrap.querySelector('.lvp-speed-wrap');
			this.speedBtn = wrap.querySelector('.lvp-speed-btn');
			this.speedMenu = wrap.querySelector('.lvp-speed-menu');
			this.speedItems = Array.from(wrap.querySelectorAll('.lvp-speed-item'));

			if (o.autoplay) {
				this.video.muted = true; // trình duyệt chỉ cho autoplay khi muted
				this.video.play().catch(() => {});
			}
		}

		_notifyGlassChanged() {
			if (this.glass) this.glass.markChanged(this.ctrlEl);
		}

		_bindEvents() {
			const { video, wrap } = this;

			// ── Play / pause ──
			const updatePlayState = () => {
				const playing = !video.paused;
				this.playIcon.className = 'ti lvp-play-icon ' + (playing ? 'ti-player-pause' : 'ti-player-play');
				wrap.classList.toggle('lvp-playing', playing);
			};
			const togglePlay = () => { video.paused ? video.play() : video.pause(); };
			this.playBtn.addEventListener('click', togglePlay);
			this.bigPlayBtn.addEventListener('click', togglePlay);
			video.addEventListener('click', (e) => { e.preventDefault(); togglePlay(); });
			video.addEventListener('play', updatePlayState);
			video.addEventListener('pause', updatePlayState);
			updatePlayState();

			// ── Mute ──
			const updateMuteIcon = () => {
				const isMuted = video.muted || video.volume === 0;
				this.muteIcon.className = 'ti lvp-mute-icon ' + (isMuted ? 'ti-volume-off' : 'ti-volume');
			};
			this.muteBtn.addEventListener('click', (e) => {
				e.preventDefault();
				video.muted = !video.muted;
				if (!video.muted && video.volume === 0) video.volume = 1;
				updateMuteIcon();
			});
			video.addEventListener('volumechange', updateMuteIcon);
			updateMuteIcon();

			// ── Toàn màn hình ──
			const updateFsIcon = () => {
				const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
				const isFs = fsEl === wrap;
				this.fsIcon.className = 'ti lvp-fullscreen-icon ' + (isFs ? 'ti-minimize' : 'ti-maximize');
			};
			this.fsBtn.addEventListener('click', (e) => {
				e.preventDefault();
				const isFs = document.fullscreenElement || document.webkitFullscreenElement;
				if (!isFs) {
					(wrap.requestFullscreen || wrap.webkitRequestFullscreen)?.call(wrap);
				} else {
					(document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
				}
			});
			this._onFsChange = updateFsIcon;
			document.addEventListener('fullscreenchange', this._onFsChange);
			document.addEventListener('webkitfullscreenchange', this._onFsChange);
			updateFsIcon();

			// ── Tốc độ phát ──
			const setActiveSpeedItem = (val) => {
				this.speedItems.forEach((item) => {
					item.classList.toggle('lvp-active', parseFloat(item.dataset.speed) === val);
				});
			};
			const openSpeedMenu = () => {
				this.speedMenu.classList.add('lvp-open');
				this.speedBtn.setAttribute('aria-expanded', 'true');
			};
			const closeSpeedMenu = () => {
				this.speedMenu.classList.remove('lvp-open');
				this.speedBtn.setAttribute('aria-expanded', 'false');
			};
			this.speedBtn.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
				this.speedMenu.classList.contains('lvp-open') ? closeSpeedMenu() : openSpeedMenu();
			});
			this.speedItems.forEach((item) => {
				item.addEventListener('click', (e) => {
					e.preventDefault();
					e.stopPropagation();
					video.playbackRate = parseFloat(item.dataset.speed);
					closeSpeedMenu();
				});
			});
			this._onDocClick = (e) => {
				if (!this.speedWrap.contains(e.target)) closeSpeedMenu();
			};
			document.addEventListener('click', this._onDocClick);
			video.addEventListener('ratechange', () => setActiveSpeedItem(video.playbackRate));
			setActiveSpeedItem(video.playbackRate);

			// ── Thời gian / thanh tiến trình ──
			const updateTimeLabel = () => {
				const dur = video.duration;
				this.timeLabel.textContent = formatTime(video.currentTime) + ' / ' + (isFinite(dur) ? formatTime(dur) : '0:00');
			};
			video.addEventListener('timeupdate', () => {
				if (!video.duration) return;
				this.fill.style.width = (video.currentTime / video.duration) * 100 + '%';
				updateTimeLabel();
			});
			video.addEventListener('loadedmetadata', updateTimeLabel);

			let scrubbing = false;
			const seekFromEvent = (e) => {
				const rect = this.progress.getBoundingClientRect();
				const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
				if (video.duration) {
					video.currentTime = ratio * video.duration;
					this.fill.style.width = ratio * 100 + '%';
					updateTimeLabel();
				}
			};
			this.progress.addEventListener('pointerdown', (e) => {
				scrubbing = true;
				this.progress.setPointerCapture(e.pointerId);
				seekFromEvent(e);
			});
			this.progress.addEventListener('pointermove', (e) => { if (scrubbing) seekFromEvent(e); });
			this.progress.addEventListener('pointerup', (e) => {
				scrubbing = false;
				this.progress.releasePointerCapture(e.pointerId);
			});

			// ── Tự ẩn control khi chuột rời khung hoặc đứng yên quá lâu ──
			let idleTimer = null;
			const showControls = () => {
				wrap.classList.remove('lvp-hidden');
				this._notifyGlassChanged();
				resetIdleTimer();
			};
			const hideControls = () => {
				if (video.paused) return;
				wrap.classList.add('lvp-hidden');
				this._notifyGlassChanged();
			};
			const resetIdleTimer = () => {
				clearTimeout(idleTimer);
				idleTimer = setTimeout(hideControls, this.options.idleHideMs);
			};
			wrap.addEventListener('mouseenter', showControls);
			wrap.addEventListener('mousemove', showControls);
			wrap.addEventListener('mouseleave', () => {
				clearTimeout(idleTimer);
				hideControls();
			});
			video.addEventListener('pause', () => {
				clearTimeout(idleTimer);
				showControls();
			});

			this._idleTimerRef = () => idleTimer;
			this._clearIdleTimer = () => clearTimeout(idleTimer);
		}

		async _initGlass() {
			try {
				const LiquidGlass = await loadLiquidGlass();
				const o = this.options;
				this.ctrlEl.dataset.config = JSON.stringify({
					cornerRadius: o.cornerRadius,
					zRadius: o.zRadius,
					blurAmount: o.blurAmount,
					brightness: o.brightness,
				});
				this.glass = await LiquidGlass.init({
					root: this.wrap,
					glassElements: [this.ctrlEl],
				});
			} catch (err) {
				console.error('LiquidVideoPlayer: không khởi tạo được LiquidGlass', err);
			}
		}

		// ── API công khai ──
		play() { this.video.play(); }
		pause() { this.video.pause(); }
		toggle() { this.video.paused ? this.video.play() : this.video.pause(); }
		mute() { this.video.muted = true; }
		unmute() { this.video.muted = false; }
		setSpeed(value) { this.video.playbackRate = value; }
		get element() { return this.wrap; }
		get videoElement() { return this.video; }

		destroy() {
			this._clearIdleTimer && this._clearIdleTimer();
			document.removeEventListener('click', this._onDocClick);
			document.removeEventListener('fullscreenchange', this._onFsChange);
			document.removeEventListener('webkitfullscreenchange', this._onFsChange);
			try { this.video.pause(); } catch (e) {}
			if (this.glass && typeof this.glass.destroy === 'function') {
				try { this.glass.destroy(); } catch (e) {}
			}
			this.wrap.remove();
		}
	}

	global.LiquidVideoPlayer = LiquidVideoPlayer;
})(window);
