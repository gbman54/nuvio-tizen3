/* i18n: English + Arabic, RTL-aware */
var I18n = (function () {
  'use strict';
  var STR = {
    en: {
      home: 'Home', search: 'Search', library: 'Library', settings: 'Settings', movies: 'Movies', series: 'Series',
      profiles: 'Profiles', continueWatching: 'Continue Watching', popular: 'Popular',
      play: 'Play', resume: 'Resume', markWatched: 'Mark Watched', markUnwatched: 'Mark Unwatched',
      addLibrary: 'Add to Library', removeLibrary: 'Remove from Library',
      seasons: 'Seasons', episodes: 'Episodes', loading: 'Loading...', retry: 'Retry',
      noResults: 'No results', unsupported: 'Unsupported on this TV: set up a resolver in Settings',
      resolver: 'Stream Resolver', mode: 'Mode', debrid: 'Debrid (direct URLs only)',
      lan: 'LAN streaming server', serverUrl: 'Server URL', adapter: 'Adapter',
      testConnection: 'Test connection', connected: 'Connected', unreachable: 'Unreachable',
      addons: 'Addons', addAddon: 'Add addon', remove: 'Remove', enable: 'Enable', disable: 'Disable',
      manifestUrl: 'Manifest URL', invalidUrl: 'Invalid URL', alreadyAdded: 'Already added',
      subtitleLang: 'Preferred subtitle language', subtitleSize: 'Subtitle size', subtitleColor: 'Subtitle color',
      audioLang: 'Preferred audio language', enforceAudioLang: 'Hide other-language streams',
      enforceAudioHint: 'Streams explicitly marked with another audio language are hidden when this is On.',
      defaultQuality: 'Default quality', playerEngine: 'Player engine',
      auto: 'Auto', avplay: 'AVPlay', html5: 'HTML5', uiLang: 'UI language',
      clearCache: 'Clear cache', clearData: 'Clear all data', about: 'About',
      version: 'Version', exit: 'Exit Nuvio Lite?', yes: 'Yes', no: 'No', cancel: 'Cancel',
      back: 'Back', done: 'Done', space: 'Space', clear: 'Clear', layout: 'Layout',
      qwerty: 'QWERTY', arabic: 'Arabic', nextEpisode: 'Next episode',
      streams: 'Streams', sources: 'Sources', quality: 'Quality', size: 'Size',
      watched: 'Watched', libraryEmpty: 'Your library is empty', profileName: 'Profile name',
      newProfile: 'New profile', trakt: 'Trakt sync (optional)', traktLogin: 'Trakt login',
      traktLogout: 'Trakt logout', traktClientId: 'Trakt client ID', traktCode: 'Open this URL and enter the code',
      traktWaiting: 'Waiting for approval...', debug: 'Debug',
      errorNetwork: 'Network error. Check connection and retry.',
      errorAddon: 'Addon failed to load', selected: 'Selected',
      rememberQuality: 'Remembered quality', close: 'Close', anonymous: 'Anonymous'
    },
    ar: {
      home: 'الرئيسية', search: 'بحث', library: 'المكتبة', settings: 'الإعدادات', movies: 'أفلام', series: 'مسلسلات',
      profiles: 'الملفات', continueWatching: 'متابعة المشاهدة', popular: 'رائج',
      play: 'تشغيل', resume: 'استئناف', markWatched: 'تعليم كمشاهَد', markUnwatched: 'تعليم كغير مشاهَد',
      addLibrary: 'إضافة للمكتبة', removeLibrary: 'إزالة من المكتبة',
      seasons: 'المواسم', episodes: 'الحلقات', loading: 'جارٍ التحميل...', retry: 'إعادة المحاولة',
      noResults: 'لا نتائج', unsupported: 'غير مدعوم على هذا التلفاز: قم بإعداد المحول في الإعدادات',
      resolver: 'محول البث', mode: 'الوضع', debrid: 'Debrid (روابط مباشرة فقط)',
      lan: 'خادم بث محلي', serverUrl: 'رابط الخادم', adapter: 'المحول',
      testConnection: 'اختبار الاتصال', connected: 'متصل', unreachable: 'غير قابل للوصول',
      addons: 'الإضافات', addAddon: 'إضافة إضافة', remove: 'إزالة', enable: 'تفعيل', disable: 'تعطيل',
      manifestUrl: 'رابط المانيفست', invalidUrl: 'رابط غير صالح', alreadyAdded: 'مضاف مسبقاً',
      subtitleLang: 'لغة الترجمة المفضلة', subtitleSize: 'حجم الترجمة', subtitleColor: 'لون الترجمة',
      audioLang: 'لغة الصوت المفضلة', enforceAudioLang: 'إخفاء المصادر بلغات أخرى',
      enforceAudioHint: 'يتم إخفاء المصادر المحددة بلغة صوت مختلفة عند تفعيل هذا الخيار.',
      defaultQuality: 'الجودة الافتراضية', playerEngine: 'محرك التشغيل',
      auto: 'تلقائي', avplay: 'AVPlay', html5: 'HTML5', uiLang: 'لغة الواجهة',
      clearCache: 'مسح ذاكرة التخزين', clearData: 'مسح كل البيانات', about: 'حول',
      version: 'الإصدار', exit: 'الخروج من Nuvio Lite؟', yes: 'نعم', no: 'لا', cancel: 'إلغاء',
      back: 'رجوع', done: 'تم', space: 'مسافة', clear: 'مسح', layout: 'التخطيط',
      qwerty: 'QWERTY', arabic: 'عربي', nextEpisode: 'الحلقة التالية',
      streams: 'البث', sources: 'المصادر', quality: 'الجودة', size: 'الحجم',
      watched: 'تمت المشاهدة', libraryEmpty: 'مكتبتك فارغة', profileName: 'اسم الملف',
      newProfile: 'ملف جديد', trakt: 'مزامنة Trakt (اختياري)', traktLogin: 'تسجيل دخول Trakt',
      traktLogout: 'خروج Trakt', traktClientId: 'معرف عميل Trakt', traktCode: 'افتح هذا الرابط وأدخل الرمز',
      traktWaiting: 'بانتظار الموافقة...', debug: 'تصحيح',
      errorNetwork: 'خطأ في الشبكة. تحقق من الاتصال وأعد المحاولة.',
      errorAddon: 'فشل تحميل الإضافة', selected: 'محدد',
      rememberQuality: 'الجودة المحفوظة', close: 'إغلاق', anonymous: 'مجهول'
    }
  };
  // ---- new settings labels ----
  STR.en.languages = 'Languages'; STR.ar.languages = 'اللغات';
  STR.en.playback = 'Playback'; STR.ar.playback = 'التشغيل';
  STR.en.scrapers = 'Scrapers'; STR.ar.scrapers = 'المزودات';
  STR.en.dataAbout = 'Data & About'; STR.ar.dataAbout = 'البيانات وحول';
  STR.en.choose = 'Choose'; STR.ar.choose = 'اختر';
  STR.en.off = 'Off'; STR.ar.off = 'إيقاف';
  STR.en.original = 'Original'; STR.ar.original = 'الأصل';
  STR.en.audioTracks = 'Audio'; STR.ar.audioTracks = 'الصوت';
  STR.en.subtitles = 'Subtitles'; STR.ar.subtitles = 'الترجمة';
  STR.en.categoryHint = 'Choose a category with ↑/↓ · press → to open its settings';
  STR.ar.categoryHint = 'اختر فئة بالأعلى/الأسفل · اضغط يميناً لفتح الإعدادات';
  STR.en.instantApply = 'Changes apply immediately'; STR.ar.instantApply = 'تُطبق التغييرات فوراً';
  STR.en.uiLanguageHint = 'Interface language and direction (RTL for Arabic)';
  STR.ar.uiLanguageHint = 'لغة الواجهة والاتجاه (من اليمين لليسار للعربية)';

  // ---- FRENCH ----
  STR.fr = {
    home: 'Accueil', search: 'Recherche', library: 'Bibliothèque', settings: 'Paramètres', movies: 'Films', series: 'Séries',
    profiles: 'Profils', continueWatching: 'Reprendre', popular: 'Populaire',
    play: 'Lire', resume: 'Reprendre', markWatched: 'Marquer vu', markUnwatched: 'Marquer non vu',
    addLibrary: 'Ajouter à la bibliothèque', removeLibrary: 'Retirer de la bibliothèque',
    seasons: 'Saisons', episodes: 'Épisodes', loading: 'Chargement…', retry: 'Réessayer',
    noResults: 'Aucun résultat', unsupported: 'Non pris en charge sur ce téléviseur : configurez un résolveur dans Paramètres',
    resolver: 'Résolveur de flux', mode: 'Mode', debrid: 'Debrid (URL directes)', lan: 'Serveur local',
    serverUrl: 'URL du serveur', adapter: 'Adaptateur', testConnection: 'Tester la connexion',
    connected: 'Connecté', unreachable: 'Inaccessible', addons: 'Extensions', addAddon: 'Ajouter une extension',
    remove: 'Supprimer', enable: 'Activer', disable: 'Désactiver', manifestUrl: 'URL du manifeste',
    invalidUrl: 'URL invalide', alreadyAdded: 'Déjà ajouté', subtitleLang: 'Langue des sous-titres',
    subtitleSize: 'Taille des sous-titres', subtitleColor: 'Couleur des sous-titres',
    audioLang: 'Langue audio', defaultQuality: 'Qualité par défaut', playerEngine: 'Moteur de lecture',
    auto: 'Auto', avplay: 'AVPlay', html5: 'HTML5', uiLang: 'Langue de l’interface',
    clearCache: 'Vider le cache', clearData: 'Effacer toutes les données', about: 'À propos',
    version: 'Version', exit: 'Quitter Nuvio Lite ?', yes: 'Oui', no: 'Non', cancel: 'Annuler',
    back: 'Retour', done: 'Terminé', space: 'Espace', clear: 'Effacer', layout: 'Disposition',
    qwerty: 'QWERTY', arabic: 'Arabe', nextEpisode: 'Épisode suivant', streams: 'Flux', sources: 'Sources',
    quality: 'Qualité', size: 'Taille', watched: 'Vu', libraryEmpty: 'Votre bibliothèque est vide',
    profileName: 'Nom du profil', newProfile: 'Nouveau profil', trakt: 'Synchronisation Trakt (optionnel)',
    traktLogin: 'Connexion Trakt', traktLogout: 'Déconnexion Trakt', traktClientId: 'ID client Trakt',
    traktCode: 'Ouvrez cette URL et saisissez le code', traktWaiting: 'En attente d’approbation…',
    debug: 'Débogage', errorNetwork: 'Erreur réseau. Vérifiez la connexion et réessayez.',
    errorAddon: 'Échec du chargement de l’extension', selected: 'Sélectionné',
    rememberQuality: 'Qualité mémorisée', close: 'Fermer', anonymous: 'Anonyme',
    languages: 'Langues', playback: 'Lecture', scrapers: 'Scrapers', dataAbout: 'Données et à propos',
    choose: 'Choisir', off: 'Désactivé', original: 'Original', audioTracks: 'Audio', subtitles: 'Sous-titres',
    categoryHint: 'Choisissez une catégorie avec ↑/↓ · appuyez sur → pour ouvrir',
    instantApply: 'Les changements s’appliquent immédiatement',
    uiLanguageHint: 'Langue et direction de l’interface (RTL pour l’arabe)'
  };

  // ---- SPANISH ----
  STR.es = {
    home: 'Inicio', search: 'Buscar', library: 'Biblioteca', settings: 'Ajustes', movies: 'Películas', series: 'Series',
    profiles: 'Perfiles', continueWatching: 'Continuar viendo', popular: 'Popular',
    play: 'Reproducir', resume: 'Reanudar', markWatched: 'Marcar visto', markUnwatched: 'Marcar no visto',
    addLibrary: 'Añadir a la biblioteca', removeLibrary: 'Quitar de la biblioteca',
    seasons: 'Temporadas', episodes: 'Episodios', loading: 'Cargando…', retry: 'Reintentar',
    noResults: 'Sin resultados', unsupported: 'No compatible con este televisor: configura un resolutor en Ajustes',
    resolver: 'Resolución de flujos', mode: 'Modo', debrid: 'Debrid (URL directas)', lan: 'Servidor local',
    serverUrl: 'URL del servidor', adapter: 'Adaptador', testConnection: 'Probar conexión',
    connected: 'Conectado', unreachable: 'Inaccesible', addons: 'Complementos', addAddon: 'Añadir complemento',
    remove: 'Eliminar', enable: 'Activar', disable: 'Desactivar', manifestUrl: 'URL del manifiesto',
    invalidUrl: 'URL no válida', alreadyAdded: 'Ya añadido', subtitleLang: 'Idioma de subtítulos',
    subtitleSize: 'Tamaño de subtítulos', subtitleColor: 'Color de subtítulos',
    audioLang: 'Idioma de audio', defaultQuality: 'Calidad predeterminada', playerEngine: 'Motor de reproducción',
    auto: 'Auto', avplay: 'AVPlay', html5: 'HTML5', uiLang: 'Idioma de la interfaz',
    clearCache: 'Borrar caché', clearData: 'Borrar todos los datos', about: 'Acerca de',
    version: 'Versión', exit: '¿Salir de Nuvio Lite?', yes: 'Sí', no: 'No', cancel: 'Cancelar',
    back: 'Atrás', done: 'Listo', space: 'Espacio', clear: 'Borrar', layout: 'Disposición',
    qwerty: 'QWERTY', arabic: 'Árabe', nextEpisode: 'Siguiente episodio', streams: 'Flujos',
    sources: 'Fuentes', quality: 'Calidad', size: 'Tamaño', watched: 'Visto',
    libraryEmpty: 'Tu biblioteca está vacía', profileName: 'Nombre del perfil', newProfile: 'Nuevo perfil',
    trakt: 'Sincronización Trakt (opcional)', traktLogin: 'Iniciar sesión Trakt',
    traktLogout: 'Cerrar sesión Trakt', traktClientId: 'ID de cliente Trakt',
    traktCode: 'Abre esta URL e introduce el código', traktWaiting: 'Esperando aprobación…',
    debug: 'Depuración', errorNetwork: 'Error de red. Comprueba la conexión y reintenta.',
    errorAddon: 'Error al cargar el complemento', selected: 'Seleccionado',
    rememberQuality: 'Calidad recordada', close: 'Cerrar', anonymous: 'Anónimo',
    languages: 'Idiomas', playback: 'Reproducción', scrapers: 'Scrapers', dataAbout: 'Datos e información',
    choose: 'Elegir', off: 'Desactivado', original: 'Original', audioTracks: 'Audio', subtitles: 'Subtítulos',
    categoryHint: 'Elige una categoría con ↑/↓ · pulsa → para abrir',
    instantApply: 'Los cambios se aplican al instante',
    uiLanguageHint: 'Idioma y dirección de la interfaz (RTL para árabe)'
  };

  // ---- TURKISH ----
  STR.tr = {
    home: 'Ana Sayfa', search: 'Ara', library: 'Kitaplık', settings: 'Ayarlar', movies: 'Filmler', series: 'Diziler',
    profiles: 'Profiller', continueWatching: 'İzlemeye devam et', popular: 'Popüler',
    play: 'Oynat', resume: 'Devam et', markWatched: 'İzlenmiş işaretle', markUnwatched: 'İzlenmemiş işaretle',
    addLibrary: 'Kitaplığa ekle', removeLibrary: 'Kitaplıktan çıkar', seasons: 'Sezonlar', episodes: 'Bölümler',
    loading: 'Yükleniyor…', retry: 'Tekrar dene', noResults: 'Sonuç yok',
    unsupported: 'Bu TV’de desteklenmiyor: Ayarlar’dan bir çözümleyici yapılandırın',
    resolver: 'Akış çözümleyici', mode: 'Mod', debrid: 'Debrid (doğrudan URL)', lan: 'Yerel sunucu',
    serverUrl: 'Sunucu URL’si', adapter: 'Bağdaştırıcı', testConnection: 'Bağlantıyı test et',
    connected: 'Bağlandı', unreachable: 'Ulaşılamıyor', addons: 'Eklentiler', addAddon: 'Eklenti ekle',
    remove: 'Kaldır', enable: 'Etkinleştir', disable: 'Devre dışı bırak', manifestUrl: 'Manifest URL’si',
    invalidUrl: 'Geçersiz URL', alreadyAdded: 'Zaten eklendi', subtitleLang: 'Altyazı dili',
    subtitleSize: 'Altyazı boyutu', subtitleColor: 'Altyazı rengi', audioLang: 'Ses dili',
    defaultQuality: 'Varsayılan kalite', playerEngine: 'Oynatıcı motoru', auto: 'Otomatik',
    avplay: 'AVPlay', html5: 'HTML5', uiLang: 'Arayüz dili', clearCache: 'Önbelleği temizle',
    clearData: 'Tüm verileri sil', about: 'Hakkında', version: 'Sürüm', exit: 'Nuvio Lite’tan çıkılsın mı?',
    yes: 'Evet', no: 'Hayır', cancel: 'İptal', back: 'Geri', done: 'Tamam', space: 'Boşluk',
    clear: 'Temizle', layout: 'Düzen', qwerty: 'QWERTY', arabic: 'Arapça', nextEpisode: 'Sonraki bölüm',
    streams: 'Akışlar', sources: 'Kaynaklar', quality: 'Kalite', size: 'Boyut', watched: 'İzlendi',
    libraryEmpty: 'Kitaplığınız boş', profileName: 'Profil adı', newProfile: 'Yeni profil',
    trakt: 'Trakt eşitleme (isteğe bağlı)', traktLogin: 'Trakt girişi', traktLogout: 'Trakt çıkışı',
    traktClientId: 'Trakt istemci kimliği', traktCode: 'Bu URL’yi açın ve kodu girin',
    traktWaiting: 'Onay bekleniyor…', debug: 'Hata ayıklama',
    errorNetwork: 'Ağ hatası. Bağlantıyı kontrol edip tekrar deneyin.',
    errorAddon: 'Eklenti yüklenemedi', selected: 'Seçili', rememberQuality: 'Hatırlanan kalite',
    close: 'Kapat', anonymous: 'Anonim', languages: 'Diller', playback: 'Oynatma',
    scrapers: 'Kazıyıcılar', dataAbout: 'Veriler ve hakkında', choose: 'Seç', off: 'Kapalı',
    original: 'Orijinal', audioTracks: 'Ses', subtitles: 'Altyazı',
    categoryHint: '↑/↓ ile kategori seçin · açmak için → tuşuna basın',
    instantApply: 'Değişiklikler hemen uygulanır',
    uiLanguageHint: 'Arayüz dili ve yönü (Arapça için RTL)'
  };

  var lang = 'en';
  function init() {
    var s = Store.settings();
    lang = s.lang || 'en';
    applyDir();
  }
  function applyDir() {
    var dir = (lang === 'ar') ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', lang);
    var app = document.getElementById('app');
    if (app) app.className = dir;
  }
  function t(key) {
    return (STR[lang] && STR[lang][key]) || STR.en[key] || key;
  }
  function setLang(l) { lang = l; Store.setSetting('lang', l); applyDir(); }
  function getLang() { return lang; }
  init();
  return { t: t, setLang: setLang, getLang: getLang, applyDir: applyDir };
})();
