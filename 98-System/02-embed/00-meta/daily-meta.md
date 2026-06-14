> [!health] 🌅 朝のコンディション
> **睡眠時間:** `INPUT[number(placeholder(7.5)):sleep_hours]` 時間
>
> **体調:** `INPUT[inlineSelect(
>   option(null, "未入力"),
>   option(1, "非常に悪い"),
>   option(2, "悪い"),
>   option(3, "普通"),
>   option(4, "良い"),
>   option(5, "非常に良い")
> ):condition]`
>
> **頭痛:** `INPUT[inlineSelect(
>   option(null, "未入力"),
>   option(0, "なし"),
>   option(1, "ごく軽い"),
>   option(2, "軽い"),
>   option(3, "中程度"),
>   option(4, "強い"),
>   option(5, "非常に強い")
> ):headache]`
>
> **天気:** `INPUT[inlineSelect(
>   option(null, "未入力"),
>   option(sunny, "☀️ 晴れ"),
>   option(partly_cloudy, "🌤️ 晴れ時々曇り"),
>   option(cloudy, "☁️ 曇り"),
>   option(rainy, "🌧️ 雨"),
>   option(snowy, "🌨️ 雪"),
>   option(stormy, "⛈️ 荒天")
> ):weather]`
> 
> **睡眠の質:** `INPUT[inlineSelect(
>   option(null, "未入力"),
>   option(1, "非常に悪い"),
>   option(2, "悪い"),
>   option(3, "普通"),
>   option(4, "良い"),
>   option(5, "非常に良い")
> ):sleep_quality]`
>
> **活力:** `INPUT[inlineSelect(
>   option(null, "未入力"),
>   option(1, "ほとんど動けない"),
>   option(2, "低い"),
>   option(3, "普通"),
>   option(4, "高い"),
>   option(5, "非常に高い")
> ):energy]`
