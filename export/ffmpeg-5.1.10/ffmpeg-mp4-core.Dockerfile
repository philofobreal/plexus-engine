# syntax=docker/dockerfile:1
# Browser-encoded AVC/VP9 stream copy and PCM16 WAV to AAC.
FROM emscripten/emsdk:3.1.40@sha256:c1e807a6e03ac5bd5b37bae2ace3c46c08579e2ddeb951037a3b8dac7067f2cc AS build
# FFmpeg n5.1.10; keep ABI compatibility with the pinned CLI binding.
ADD https://github.com/FFmpeg/FFmpeg.git#19feb712f5c1821d8a3fa1ad63c5bd2e3b9672eb /src
ADD https://github.com/ffmpegwasm/ffmpeg.wasm.git#c3a763857c5e615ae8674715ad5e4f63ff469e9d /binding
WORKDIR /src
RUN emconfigure ./configure \
      --target-os=none --arch=x86_32 --enable-cross-compile --disable-asm --disable-stripping \
      --disable-programs --disable-doc --disable-debug --disable-runtime-cpudetect --disable-autodetect \
      --disable-everything --disable-network --disable-pthreads --disable-w32threads --disable-os2threads \
      --nm=emnm --ar=emar --ranlib=emranlib --cc=emcc --cxx=em++ --objcc=emcc --dep-cc=emcc \
      --enable-protocol=file --enable-demuxer=mov,wav --enable-muxer=mp4 \
      --enable-decoder=pcm_s16le,vp9 --enable-encoder=aac --enable-parser=aac,h264,vp9 \
      --enable-filter=abuffer,abuffersink,aformat,anull,aresample,atrim,buffer,buffersink,format,null,trim \
    && emmake make -j6
RUN mkdir -p /out \
    && emcc -O2 -I. -I/binding/src/fftools -Wno-deprecated-declarations \
      /binding/src/fftools/cmdutils.c /binding/src/fftools/ffmpeg.c /binding/src/fftools/ffmpeg_filter.c \
      /binding/src/fftools/ffmpeg_hw.c /binding/src/fftools/ffmpeg_mux.c \
      /binding/src/fftools/ffmpeg_opt.c /binding/src/fftools/opt_common.c \
      libavdevice/libavdevice.a libavfilter/libavfilter.a libavformat/libavformat.a libavcodec/libavcodec.a \
      libswresample/libswresample.a libswscale/libswscale.a libavutil/libavutil.a \
      -sWASM_BIGINT -sMODULARIZE -sEXPORT_ES6 -sEXPORT_NAME=createFFmpegCore \
      -sINITIAL_MEMORY=33554432 -sALLOW_MEMORY_GROWTH -sMAXIMUM_MEMORY=268435456 \
      -sEXPORTED_FUNCTIONS="$(node /binding/src/bind/ffmpeg/export.js)" \
      -sEXPORTED_RUNTIME_METHODS="$(node /binding/src/bind/ffmpeg/export-runtime.js)" \
      -lworkerfs.js --pre-js /binding/src/bind/ffmpeg/bind.js -o /out/ffmpeg-core.js \
    && cp COPYING.LGPLv2.1 /out/FFmpeg-COPYING.LGPLv2.1 \
    && cp /binding/LICENSE /out/ffmpeg.wasm-LICENSE
FROM scratch
COPY --from=build /out/ /
