#include <stdint.h>
#include <stddef.h>
#include <vpx/vpx_encoder.h>
#include <vpx/vp8cx.h>

/* A fixed-size laboratory clip. The JS worker borrows one packet at a time. */
enum { WIDTH = 1280, HEIGHT = 720, FPS = 30, FRAMES = 30 };
static vpx_codec_ctx_t codec;
static vpx_image_t image;
static vpx_codec_iter_t packet_iterator;
static const vpx_codec_cx_pkt_t *packet;
static int opened;

int probe_close(void) {
    if (!opened) return 0;
    vpx_img_free(&image);
    opened = 0;
    packet = NULL;
    return vpx_codec_destroy(&codec);
}

#ifdef PROBE_TUNING
static unsigned long deadline;
int probe_open_profile(int realtime, int quantizer) {
    if (opened) return -1;
    if ((realtime != 0 && realtime != 1) || quantizer < 0 || quantizer > 63) return -6;
    deadline = realtime ? VPX_DL_REALTIME : VPX_DL_GOOD_QUALITY;
#else
int probe_open(void) {
    const int quantizer = 0;
    if (opened) return -1;
#endif
    vpx_codec_enc_cfg_t config;
    if (vpx_codec_enc_config_default(vpx_codec_vp9_cx(), &config, 0)) return -2;
    config.g_w = WIDTH;
    config.g_h = HEIGHT;
    config.g_profile = 2;
    config.g_bit_depth = VPX_BITS_10;
    config.g_input_bit_depth = 10;
    config.g_timebase.num = 1;
    config.g_timebase.den = FPS;
    config.g_threads = 1;
    config.g_lag_in_frames = 0;
    config.kf_mode = VPX_KF_DISABLED;
    if (quantizer) {
        config.rc_end_usage = VPX_Q;
        config.rc_min_quantizer = (unsigned int)quantizer;
        config.rc_max_quantizer = (unsigned int)quantizer;
    }
    if (vpx_codec_enc_init(&codec, vpx_codec_vp9_cx(), &config, VPX_CODEC_USE_HIGHBITDEPTH)) return -3;
    if (!vpx_img_alloc(&image, VPX_IMG_FMT_I42016, WIDTH, HEIGHT, 32)) {
        vpx_codec_destroy(&codec);
        return -4;
    }
    opened = 1;
    image.bit_depth = 10;
    image.cs = VPX_CS_BT_709;
    image.range = VPX_CR_STUDIO_RANGE;
    if (vpx_codec_control(&codec, VP8E_SET_CPUUSED, 8)
        || vpx_codec_control(&codec, VP9E_SET_LOSSLESS, (unsigned int)(quantizer == 0))
        || vpx_codec_control(&codec, VP9E_SET_COLOR_SPACE, VPX_CS_BT_709)
        || vpx_codec_control(&codec, VP9E_SET_COLOR_RANGE, VPX_CR_STUDIO_RANGE)) {
        probe_close();
        return -5;
    }
    return 0;
}

#ifdef PROBE_TUNING
int probe_open(void) {
    return probe_open_profile(0, 0);
}
#endif

int probe_fill(int frame) {
    if (!opened || frame < 0 || frame >= FRAMES) return -1;
    const int band = 210 + 26 * frame;
    for (int y = 0; y < HEIGHT; ++y) {
        uint16_t *line = (uint16_t *)(image.planes[0] + y * image.stride[0]);
        for (int x = 0; x < WIDTH; ++x) {
            /* Smooth gradients, fine stripes and one moving edge. */
            int level = 80 + (x * 590 / WIDTH) + (y * 148 / HEIGHT);
            if (x >= band && x < band + 90 && y > 210 && y < 510) {
                level += 75 + ((x + y + frame) & 3) * 7;
            }
            if (y < 32 && x < 192) level = ((frame + 1) & (1 << (x / 32))) ? 940 : 64;
            line[x] = (uint16_t)level;
        }
    }
    for (int y = 0; y < HEIGHT / 2; ++y) {
        uint16_t *u = (uint16_t *)(image.planes[1] + y * image.stride[1]);
        uint16_t *v = (uint16_t *)(image.planes[2] + y * image.stride[2]);
        for (int x = 0; x < WIDTH / 2; ++x) {
            u[x] = (uint16_t)(410 + x * 180 / (WIDTH / 2));
            v[x] = (uint16_t)(610 - y * 200 / (HEIGHT / 2));
        }
    }
    return 0;
}

const void *probe_plane(int plane) {
    return opened && plane >= 0 && plane < 3 ? image.planes[plane] : NULL;
}
int probe_stride(int plane) {
    return opened && plane >= 0 && plane < 3 ? image.stride[plane] : 0;
}

int probe_encode(int frame) {
    if (!opened || frame < -1 || frame >= FRAMES) return -1;
    packet_iterator = NULL;
    packet = NULL;
#ifndef PROBE_TUNING
    const unsigned long deadline = VPX_DL_GOOD_QUALITY;
#endif
    return vpx_codec_encode(&codec, frame >= 0 ? &image : NULL, frame < 0 ? FRAMES : frame, 1,
                            frame >= 0 ? VPX_EFLAG_FORCE_KF : 0, deadline);
}

int probe_next_packet(void) {
    while ((packet = vpx_codec_get_cx_data(&codec, &packet_iterator)) != NULL) {
        if (packet->kind == VPX_CODEC_CX_FRAME_PKT) return 1;
    }
    return 0;
}
const void *probe_packet_data(void) { return packet ? packet->data.frame.buf : NULL; }
size_t probe_packet_size(void) { return packet ? packet->data.frame.sz : 0; }
int probe_packet_index(void) { return packet ? (int)packet->data.frame.pts : -1; }
int probe_packet_is_key(void) { return packet && (packet->data.frame.flags & VPX_FRAME_IS_KEY); }
const char *probe_error(void) {
    const char *detail = vpx_codec_error_detail(&codec);
    return detail ? detail : vpx_codec_error(&codec);
}
