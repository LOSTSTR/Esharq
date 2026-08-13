# إضافاتك أنت — Your own plugins

هذا المجلد **لك**، ويبدأ فارغاً عمداً.

ضع فيه إضافتك (مجلد فيه `index.ts` أو `index.tsx`، أو ملف `.ts`/`.tsx` واحد)
ثم ابنِ إشراق، فتظهر في الإعدادات ضمن **«الإضافات الشخصية»** وحدها — لا مختلطة
بإضافات إشراق التي تسكن `src/esharqplugins/`.

هذا الفصل مقصود: العدّاد الذي يقول «الإضافات الشخصية» يجب أن يعني ما أضفتَه
أنت، لا ما جاء مع المُعدِّل.

---

This folder is **yours**, and starts empty on purpose.

Drop your plugin here (a directory containing `index.ts`/`index.tsx`, or a
single `.ts`/`.tsx` file) and build Esharq. It will appear in settings under
**User Plugins** on its own — not mixed in with Esharq's own plugins, which
live in `src/esharqplugins/`.

The separation is deliberate: a counter labelled "user plugins" should mean
what *you* added, not what shipped with the mod.

> ⚠️ ملف بيانات (`.json` مثلاً) بجوار إضافة **يُسجَّل إضافةً بلا اسم** ويُسقط
> صفحة الإضافات. ضع البيانات داخل مجلد الإضافة، أو ابدأ اسمه بـ`_`.
>
> ⚠️ A data file (e.g. `.json`) sitting beside a plugin registers as a nameless
> plugin and breaks the plugins page. Keep data inside your plugin's folder, or
> prefix its name with `_`.
