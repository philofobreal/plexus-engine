# syntax=docker/dockerfile:1
FROM emscripten/emsdk:3.1.40@sha256:c1e807a6e03ac5bd5b37bae2ace3c46c08579e2ddeb951037a3b8dac7067f2cc AS build
# libvpx v1.17.0, resolved commit
ADD --keep-git-dir=true https://github.com/webmproject/libvpx.git#v1.17.0 /source
RUN test "$(git -C /source rev-parse HEAD)" = 6df3ec34557879fff673706f4a1d9fbd0f3a6f0e \
    && git -C /source archive --prefix=libvpx-1.17.0/ HEAD | gzip -n > /libvpx-source.tar.gz \
    && mkdir /libvpx && tar -xzf /libvpx-source.tar.gz -C /libvpx --strip-components=1
WORKDIR /libvpx
ARG WASM_SIMD_FLAGS=
RUN AR=emar LD=emcc emconfigure ./configure --target=generic-gnu --disable-runtime-cpu-detect \
    --disable-multithread --disable-vp8 --disable-vp9-decoder --enable-vp9-highbitdepth \
    --disable-examples --disable-tools --disable-docs --disable-unit-tests \
    --disable-webm-io --disable-libyuv --disable-install-bins --disable-debug-libs \
    --extra-cflags="$WASM_SIMD_FLAGS" \
    && emmake make -j4
COPY vp9-10bit-probe.c /probe.c
ARG PROBE_TUNING=0
RUN case "$PROBE_TUNING" in \
        0) tuning_flag=; tuning_export= ;; \
        1) tuning_flag=-DPROBE_TUNING; tuning_export=',"_probe_open_profile"' ;; \
        *) exit 1 ;; \
    esac \
    && mkdir /out \
    && emcc -O3 $WASM_SIMD_FLAGS $tuning_flag -I. /probe.c libvpx.a -o /out/vp9-10bit-probe.mjs \
    --no-entry -sMODULARIZE=1 -sEXPORT_ES6=1 -sFILESYSTEM=0 -sALLOW_MEMORY_GROWTH=1 \
    -sEXPORTED_RUNTIME_METHODS='["UTF8ToString"]' \
    -sINITIAL_MEMORY=16777216 -sMAXIMUM_MEMORY=134217728 \
    -sEXPORTED_FUNCTIONS='["_probe_error","_probe_open","_probe_close","_probe_fill","_probe_plane","_probe_stride","_probe_encode","_probe_next_packet","_probe_packet_data","_probe_packet_size","_probe_packet_index","_probe_packet_is_key"'"$tuning_export"']' \
    && cp LICENSE PATENTS /out/ \
    && cp /libvpx-source.tar.gz /out/
FROM scratch
COPY --from=build /out/ /
