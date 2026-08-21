/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * فحصٌ ذاتيّ لمحلّل معرض الثيمات.
 *
 * 🔴 قراءةُ صفحةٍ ليست واجهةً برمجية: شكلُ الصفحة قد يتغيّر بلا إنذار. وهذا
 * الفحص يُثبّت الشكل الذي قِيس، فيسقط في البوّابة يوم يتغيّر — لا عند مستخدمٍ
 * يرى مكتبةً فارغة ولا يعرف لماذا.
 *
 * والعيّنة **منسوخةٌ حرفياً** من الصفحة الحقيقية يوم 2026-08-21.
 */

import { fileNameFor, parseThemes } from "../../src/main/themeLibraryParse";

const SAMPLE = [
    'yName:"ungiglio"}}},{id:23,name:"ClearVision",description:"Highly customizable theme for BetterDiscord (and Powercord).",',
    'downloads:2792144,thumbnailId:176,typeId:1,authorId:17650,creationDate:new Date(1614021779764),',
    'releaseDate:"2025-12-11 01:46:54.490253+00",type:a,thumbnail:{id:176,name:"6-stable.4.7.9.png"},',
    'tags:["transparent","customizable","dark","blue"],likes:"1856",',
    'author:{id:17650,loginId:217405,githubId:"58749666",githubName:"NyxIsBad",guildId:null,login:{displayName:"NyxIsBad"}}},',
    '{id:209,name:"Discord+",description:"A sleek, customizable Discord theme, inspired by Material",',
    'downloads:1483473,thumbnailId:548,typeId:1,authorId:99,creationDate:new Date(1),releaseDate:"x",',
    'tags:["dark","material"],likes:"900",author:{id:99,login:{displayName:"Gibbu"}}}'
].join("");

let errors = 0;
const check = (name: string, pass: boolean, detail = "") => {
    if (!pass) errors++;
    console.log(`  ${pass ? "✔" : "✘"} ${name}${detail ? "  — " + detail : ""}`);
};

const themes = parseThemes(SAMPLE);

check("يُستخرَج ثيمان", themes.length === 2, String(themes.length));

const cv = themes.find(t => t.id === 23);
check("الاسم", cv?.name === "ClearVision", cv?.name);
check("المؤلّف من الكائن المتداخل", cv?.author === "NyxIsBad", cv?.author);
check("عدّاد التنزيل رقماً", cv?.downloads === 2792144, String(cv?.downloads));
check("الإعجابات رقماً لا نصّاً", cv?.likes === 1856, String(cv?.likes));
check("الوسوم أربعة", cv?.tags.length === 4, cv?.tags.join(","));
check("المصغّرة تُبنى من رقمها", cv?.thumbnail === "https://betterdiscord.app/image/176", cv?.thumbnail);
check("الوصف", (cv?.description ?? "").startsWith("Highly customizable"), cv?.description.slice(0, 24));

// ضوابط سالبة: ما ليس ثيماً لا يُحسَب، وما لا يصلح اسماً يُنقّى.
check("المؤلّف المفرد لا يُحسَب ثيماً", !themes.some(t => t.id === 17650 || t.id === 99));
check("اسم الملفّ ينقّي المحارف", fileNameFor("Discord+ / v2", 209) === "Discord-v2-209.theme.css", fileNameFor("Discord+ / v2", 209));
check("اسمٌ فارغ لا يُنتج ملفّاً بلا اسم", fileNameFor("###", 7) === "theme-7.theme.css", fileNameFor("###", 7));
check("لا مسار في اسم الملفّ", !fileNameFor("../../evil", 5).includes("/"), fileNameFor("../../evil", 5));

// شكلٌ مختلف تماماً ⇒ صفر، وهو ما يجعل الصفحة تقول «تغيّر الشكل».
check("شكلٌ غريب يُرجع صفراً", parseThemes("<html>nothing here</html>").length === 0);

// المؤلّف المُشار إليه بمتغيّر: يُحلّ من جدول الأرقام، وإلّا يبقى فارغاً بصدق.
const REFERENCED = [
    '{id:50,loginId:9,githubId:"1",githubName:"gh",guildId:null,login:{displayName:"DiscordStyles"}},',
    '{id:174,name:"Dark Matter",description:"A cold theme.",downloads:2128004,thumbnailId:387,',
    'typeId:1,authorId:50,creationDate:new Date(1),releaseDate:"x",thumbnail:{id:387,name:"p.png"},',
    'tags:["transparent"],likes:"1135",author:t}'
].join("");
const linked = parseThemes(REFERENCED).find(x => x.id === 174);
check("مؤلّفٌ بالإشارة يُحلّ بالرقم", linked?.author === "DiscordStyles", linked?.author);

const orphan = parseThemes('{id:9,name:"Orphan",description:"d",downloads:1,thumbnailId:2,authorId:999,tags:[],likes:"0",author:z}');
check("مؤلّفٌ مجهول يبقى فارغاً لا مخترعاً", orphan[0]?.author === "", JSON.stringify(orphan[0]?.author));

console.log(`themeLibraryParse self-test: ${errors} error(s)`);
process.exit(errors === 0 ? 0 : 1);
