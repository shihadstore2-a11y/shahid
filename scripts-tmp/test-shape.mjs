import ArabicReshaper from "arabic-reshaper";
import bidiFactory from "bidi-js";
const bidi = bidiFactory();
const text = "رِفد منصة سعودية متخصصة";
const reshaped = ArabicReshaper.convertArabic(text);
console.log("reshaped:", JSON.stringify(reshaped));
const levels = bidi.getEmbeddingLevels(reshaped, "rtl");
const reordered = bidi.getReorderedString(reshaped, levels);
console.log("reordered:", JSON.stringify(reordered));
