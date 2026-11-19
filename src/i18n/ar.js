// SPDX-FileCopyrightText: 2026 Kiomet clone contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// العربية — note `dir: 'rtl'`: the shell flips to right-to-left, so every `left`/`right`
// in index.html is written logically (see the [dir="rtl"] rules there).

export default {
    meta: { name: 'العربية', short: 'ع', dir: 'rtl', htmlLang: 'ar', font: '"Noto Naskh Arabic","Segoe UI","Microsoft Yahei",system-ui,sans-serif' },

    // ---------------- عام ----------------
    'app.title': 'Kiomet — دفاع إقليمي فوري',
    'common.close': 'إغلاق',
    'common.cancel': 'إلغاء',
    'common.ok': 'حسناً',
    'common.language': 'اللغة',

    // ---------------- لوحة المعلومات ----------------
    'hud.score': 'النقاط',
    'hud.towers': 'الأبراج',
    'hud.life': 'الحياة',
    'hud.leaderboard': 'لوحة المتصدرين',
    'hud.footer': '{towers} برجاً · {players} لاعباً',

    // ---------------- الدردشة ----------------
    'chat.placeholder': 'اكتب شيئاً…',

    // ---------------- التكبير ----------------
    'zoom.out': 'تصغير',
    'zoom.in': 'تكبير',
    'zoom.center': 'ابحث عن ملكي',

    // ---------------- الأزرار ----------------
    'btn.pause': 'إيقاف مؤقت',
    'btn.resume': 'متابعة',
    'btn.speed': 'سرعة اللعبة',
    'btn.god': 'وضع الخلود',
    'btn.fog': 'الضباب: مفعّل',
    'btn.fogOff': 'الضباب: مُعطّل',
    'btn.fogTitle': 'ضباب الحرب (المفتاح B)',
    'btn.help': 'مساعدة',
    'btn.towers': 'الأبراج',
    'btn.units': 'الوحدات',
    'btn.newgame': 'لعبة جديدة',

    // ---------------- شاشة البداية ----------------
    'spawn.sub': 'دفاع إقليمي فوري · نسخة دون اتصال',
    'spawn.name': 'الاسم المستعار',
    'spawn.play': 'ابدأ',

    // ---------------- التنبيهات المؤقتة ----------------
    'toast.godOn': 'وضع الخلود مفعّل — ملكك لا يموت',
    'toast.godOff': 'وضع الخلود مُعطّل',
    'toast.supplyOn': 'عرض كل خطوط الإمداد (R)',
    'toast.supplyOff': 'خطوط الإمداد مخفية',
    'toast.prereq': 'المتطلبات السابقة ناقصة',
    'toast.supplyRemoved': 'تم حذف خط الإمداد',
    'toast.supplyNone': 'لا توجد خطوط إمداد لحذفها',
    'toast.kingConfirm': 'أبقِ المؤشر على الهدف لبعض الوقت لإرسال ملكك',
    'toast.intro': 'انقر برجاً لعرض قائمته · اسحب من أبراجك لإرسال الوحدات · المفتاح H يجد ملكك',
    'toast.menuHint': 'انقر للانتقال',

    // ---------------- التنبيهات ----------------
    'alert.rulerAttack.title': 'ملكك يتعرض لهجوم!',
    'alert.rulerAttack.hint': 'إذا مات فستخسر اللعبة',
    'alert.rulerUnsafe.title': 'انقل ملكك إلى مكان آمن',
    'alert.rulerUnsafe.hint': 'القواعد والمخابئ المدرّعة قرب وسط منطقتك توفر الحماية الأكبر',
    'alert.capture.title': 'احتجز مزيداً من الأبراج',
    'alert.capture.hint': 'اسحب الوحدات من أبراجك إلى ما وراء حدودك',
    'alert.upgrade.title': 'طوّر برجاً',
    'alert.upgrade.hint': 'انقر على برج لعرض خيارات التطوير',
    'alert.full.title': 'أحد الأبراج ممتلئ',
    'alert.full.hint': 'اسحب الوحدات بعيداً لإفساح المجال',
    'alert.overflow.title': 'أحد الأبراج يفيض',
    'alert.overflow.hint': 'اسحب الوحدات بعيداً حتى لا تختفي',
    'alert.zombies.title': 'رُصدت زومبي',
    'alert.zombies.hint': 'اهرب منها بالتحرك في الاتجاه المعاكس',
    'alert.kingDead': 'قُتل ملكك!',

    // ---------------- سبب الموت ----------------
    'death.default': 'قُتل ملكك!',
    'death.byZombies': 'قُتل الملك على يد الزومبي!',
    'death.byPlayer': 'قُتل الملك على يد {unit} للاعب {player}!',
    'death.byPlayerNoUnit': 'قُتل الملك على يد {player}!',
    'death.someone': 'شخص ما',
    'death.zombies': 'الزومبي',

    // ---------------- قائمة البرج ----------------
    'menu.upgrading': 'جارٍ التطوير… {seconds} ث',
    'menu.upgradeTo': 'طوّر إلى {tower}',
    'menu.downgradeTo': 'خفّض إلى {tower}',
    'menu.cancelSupply': 'إلغاء خط الإمداد',
    'menu.hintMobile': 'اسحب لإرسال الوحدات. اختر أولاً ثم اسحب لإنشاء خط إمداد.',
    'menu.hintStatic': 'اسحب لإرسال الوحدات.',
    'menu.unowned': 'بلا مالك',
    'menu.requestAlly': 'اطلب تحالفاً',
    'menu.acceptAlly': 'اقبل التحالف',
    'menu.breakAlly': 'انهِ التحالف',

    // ---------------- أخطاء المحرّك ----------------
    'err.sourceNotOwned': 'برج الانطلاق ليس ملكك',
    'err.emptyForce': 'لا شيء لإرساله',
    'err.pathTooShort': 'المسار قصير جداً',
    'err.pathTooLong': 'المسار طويل جداً',
    'err.sourceMismatch': 'عدم تطابق برج الانطلاق',
    'err.duplicateTower': 'برج مكرر في المسار',
    'err.edgeTooLong': 'الطريق طويل جداً',
    'err.notNeighbor': 'لا يوجد طريق بين هذين البرجين',
    'err.notGenerated': 'هذا البرج غير موجود',
    'err.invalidSupply': 'هذا البرج لا يمكنه بدء خط إمداد',
    'err.noTower': 'لا يوجد برج هنا',
    'err.notOwned': 'هذا البرج ليس ملكك',
    'err.upgradePending': 'التطوير لم يكتمل بعد',
    'err.badType': 'نوع برج غير صالح',
    'err.prereq': 'المتطلبات السابقة ناقصة',
    'err.invalidUpgrade': 'لا يمكن التطوير بهذه الطريقة',

    // ---------------- المساعدة ----------------
    'help.title': 'مساعدة',
    'help.body': `
<p>Kiomet لعبة استراتيجية فورية: وسّع منطقتك بإرسال الوحدات لاحتلال الأبراج.</p>
<h3>كيف تلعب</h3>
<p>اسحب الوحدات لاحتلال الأبراج. لتطوير برج، انقر عليه ثم انقر على تطوير متاح.
تُدرج المتطلبات بجانب كل تطوير.</p>
<h3>كيف تفوز</h3>
<p>اجمع النقاط باحتلال الأبراج والحفاظ عليها أطول وقت ممكن. احمِ ملكك —
فقدانه يعني خسارة اللعبة. يستطيع المخبأ أو القاعدة تحمّل بعض القنابل النووية.</p>
<h3>خطوط الإمداد</h3>
<p>الأبراج التي تنتج وحدات يمكنها إرسالها تلقائياً. انقر على برج لفتح قائمته ثم اسحب منه كالمعتاد؛
إذا ظهرت أسهم متحركة على المسار فقد نجحت. اضغط باستمرار على <b>R</b> لعرض كل خطوط إمدادك.
احذف خطاً بإعادة رسمه أو بـ <b>Shift+R</b>.</p>
<h3>التحالفات</h3>
<p>اختر برجاً للاعب آخر وانقر زر المصافحة لطلب تحالف أو قبوله.
حتى يتم فسخه لا يستطيع أي طرف مهاجمة الآخر.</p>
<h3>المفاتيح</h3>
<p><b>H</b> اعثر على ملكك · <b>Q</b>/<b>E</b> تكبير · <b>WASD</b> أو الأسهم للتحريك ·
<b>T</b> علّم أبراج النوع المحدد · <b>R</b> خطوط الإمداد · <b>B</b> ضباب الحرب ·
<b>مسافة</b> إيقاف مؤقت · <b>Esc</b> إغلاق القوائم.</p>`,

    // ---------------- صفحة الأبراج ----------------
    'towers.title': 'الأبراج',
    'towers.lead': 'الأبراج السبعة والعشرون. الخطوط المتصلة تطويرات، والمتقطعة متطلبات سابقة.',
    'towers.upgradesFrom': 'يُطوَّر من {icon} <b>{tower}</b> (خلال {seconds} ث)',
    'towers.upgradesFromReq': 'يُطوَّر من {icon} <b>{tower}</b> (خلال {seconds} ث)، ويتطلب {reqs}',
    'towers.foundOnMap': 'موجود على الخريطة.',
    'towers.canContain': 'يمكنه احتواء {units}.',
    'towers.generates': 'ينتج {units}',
    'towers.generatesEvery': '{unit} (كل {seconds} ث)',
    'towers.generatesNothing': 'لا شيء',
    'towers.worth': '، بقيمة {points} نقطة.',
    'towers.sensor': 'مدى رؤيته أعلى بنسبة {percent}%.',
    'towers.projector': 'يمكنه إرسال الدروع عبر الطرق.',

    // ---------------- صفحة الوحدات ----------------
    'units.title': 'الوحدات',
    'units.lead': 'الوحدات العشر. تتقاتل عموماً بالترتيب المذكور — والدرع يمتص الضرر دائماً أولاً.',
    'units.producedBy': 'يُنتَج في {makers}.',
    'units.damage': 'يوقع {surface} من الضرر.',
    'units.damageBoth': 'يوقع {surface} من الضرر على السطح، و{air} من الضرر على الجو.',
    'units.infinite': 'لانهائي',
    'units.speed.slow': 'يتحرك بسرعة بطيئة.',
    'units.speed.normal': 'يتحرك بسرعة متوسطة.',
    'units.speed.fast': 'يتحرك بسرعة عالية.',
    'units.speed.shield': 'ساكن لا يتحرك.',
    'units.shieldSpecial': 'ساكن ما لم يُرسله المبرق، وفي هذه الحالة يتحرك بسرعة.',
    'units.range.short': 'مداه قصير.',
    'units.range.medium': 'مداه متوسط.',
    'units.range.long': 'مداه طويل.',
    'units.weight': 'وزنه {weight} بالنسبة للمروحيات.',
    'units.chopper': 'يمكنه حمل وحدات أخرى (وزن 4).',
    'units.emp': 'يعطّل برجاً لمدة 60 ث.',
    'units.overflow': 'يمكن أن يتجاوز البرج مؤقتاً حتى {count}.',
    'units.king': 'يزيد سعة الدرع بمقدار {boost}. إذا مات فستخسر اللعبة.',

    // ---------------- أسماء الأبراج ----------------
    'tower.Airfield': 'مطار',
    'tower.Armory': 'مستودع أسلحة',
    'tower.Artillery': 'مدفعية',
    'tower.Barracks': 'ثكنات',
    'tower.Bunker': 'مخبأ',
    'tower.Centrifuge': 'جهاز طرد مركزي',
    'tower.City': 'مدينة',
    'tower.Cliff': 'جرف',
    'tower.Ews': 'إنذار مبكر',
    'tower.Factory': 'مصنع',
    'tower.Generator': 'مولّد',
    'tower.Headquarters': 'قاعدة',
    'tower.Helipad': 'مهبط طائرات',
    'tower.Launcher': 'منصة إطلاق',
    'tower.Mine': 'منجم',
    'tower.Projector': 'مبرق',
    'tower.Quarry': 'مقلع',
    'tower.Radar': 'رادار',
    'tower.Rampart': 'سور',
    'tower.Reactor': 'مفاعل',
    'tower.Refinery': 'مصفاة',
    'tower.Rocket': 'صاروخ',
    'tower.Runway': 'مدرج',
    'tower.Satellite': 'قمر صناعي',
    'tower.Silo': 'حفرة صواريخ',
    'tower.Town': 'بلدة',
    'tower.Village': 'قرية',

    // ---------------- أسماء الوحدات ----------------
    'unit.Shield': 'درع',
    'unit.Fighter': 'مقاتلة',
    'unit.Chopper': 'مروحية',
    'unit.Bomber': 'قاذفة',
    'unit.Tank': 'دبابة',
    'unit.Soldier': 'جندي',
    'unit.Shell': 'قذيفة',
    'unit.Emp': 'نبضة كهرومغناطيسية',
    'unit.Nuke': 'قنبلة نووية',
    'unit.King': 'الملك',
};
