"""소재 영상의 권리 판정, 출처 표기, 원작자 허락 요청 메일.

영상에서 말한 "원본에 자막만 입히면 2차 창작이라 괜찮다"는 사실이 아닙니다.
유튜브 표준 라이선스 영상은 원작자 허락 없이 다시 올리면 저작권 침해이고,
'재사용 콘텐츠' 정책으로 수익 창출이 거절되거나 채널이 정지될 수 있습니다.
이 모듈은 쓸 수 있는 소재와 허락이 필요한 소재를 나누고, 허락 받는 과정을 돕습니다.
"""

from __future__ import annotations

from .models import Candidate

VERDICT = {
    "cc_by": "사용 가능 — 크리에이티브 커먼즈 저작자 표시(CC BY). 설명란에 원작자·원본 링크를 반드시 적으세요.",
    "permission_needed": "허락 필요 — 표준 YouTube 라이선스. 원작자의 서면(메일·DM) 허락을 받기 전에는 영상을 쓰지 마세요.",
    "own": "직접 촬영/구매한 영상 — 사용 가능",
}

CHECKLIST = [
    "원본 라이선스 확인: CC BY이거나, 원작자의 서면 허락(메일 캡처)을 보관했다",
    "설명란 맨 위에 원작자 채널명·원본 링크·라이선스를 적었다",
    "원본을 그대로 이어 붙이지 않고, 한국어 해설·정보·편집으로 새로운 가치를 더했다(재사용 콘텐츠 정책)",
    "배경 음악은 원본 음원을 지우고 저작권 없는 음원(YouTube 오디오 보관함 등)으로 바꿨다",
    "원작자가 하지 않은 말을 지어내 자막으로 넣지 않았다",
    "다른 나라를 깎아내리는 비교·과장된 '국뽕' 표현을 사실로 확인했거나 뺐다",
    "AI 음성·합성 화면을 썼다면 업로드 시 '변경되거나 합성된 콘텐츠' 표시를 켰다",
    "아이 등 일반인 얼굴이 크게 나오면 흐림 처리를 검토했다",
]


def verdict(c: Candidate) -> str:
    return VERDICT[c.rights]


def attribution(c: Candidate) -> str:
    if c.rights == "own":
        return ""
    lic = "CC BY (크리에이티브 커먼즈 저작자 표시)" if c.rights == "cc_by" else "원작자 허락을 받아 사용"
    return (
        f"🎬 원본 영상: {c.title}\n"
        f"👤 원작자: {c.channel} (https://www.youtube.com/channel/{c.channel_id})\n"
        f"🔗 {c.url}\n"
        f"📄 {lic}"
    )


def permission_email(c: Candidate, my_channel: str = "[내 채널 이름]", my_name: str = "[내 이름]") -> str:
    """원작자에게 보낼 영어 허락 요청 메일. 수익 배분 제안을 넣으면 허락 받을 확률이 높아집니다."""
    return f"""Subject: Permission request: Korean subtitles for "{c.title}"

Hi {c.channel},

I'm {my_name}, and I run a Korean YouTube channel, "{my_channel}", that introduces how visitors experience Korea to Korean viewers.

I really enjoyed your video "{c.title}" ({c.url}). Would you allow me to publish a Korean-language version of it on my channel? Here is exactly what I would do:

- Add Korean subtitles and Korean commentary about the places and culture in your video
- Put your channel name and a link to your original video at the top of the description and on screen
- Not alter the meaning of anything you say
- Remove the video right away if you ever ask me to

If you'd like, I'm happy to share a portion of the ad revenue from this video with you (for example, 30–50%).

Could you reply to this email to let me know whether that's OK? If you have any conditions, I'll follow them.

Thank you!
{my_name}
{my_channel}
"""
