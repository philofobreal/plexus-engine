/** VP9 stream-copy metadata, not a pixel conversion. Canvas export is SDR;
 * missing/unspecified values use the accepted WebM path's BT.709 defaults.
 * Explicit encoder CICP or VideoColorSpace metadata takes precedence.
 */
export interface Mp4Vp9Color { readonly primaries: string; readonly transfer: string }
const primaries: Record<string,string> = { '1':'bt709','5':'bt470bg','6':'smpte170m','9':'bt2020','12':'smpte432',
    bt709:'bt709',bt470bg:'bt470bg',smpte170m:'smpte170m',bt2020:'bt2020',smpte432:'smpte432' };
const transfer: Record<string,string> = { '1':'bt709','6':'smpte170m','8':'linear','13':'iec61966-2-1','16':'smpte2084','18':'arib-std-b67',
    bt709:'bt709',smpte170m:'smpte170m',linear:'linear','iec61966-2-1':'iec61966-2-1',pq:'smpte2084',hlg:'arib-std-b67' };
const read=(map: Record<string,string>,value: unknown) => typeof value==='string'&&Object.hasOwn(map,value)?map[value]:undefined;

export function resolveMp4Vp9Color(value?: {codec?:string;colorSpace?:unknown}): Mp4Vp9Color {
    const parts=value?.codec?.startsWith('vp09.')?value.codec.split('.'):[];
    const space=value?.colorSpace && typeof value.colorSpace==='object'
        ? value.colorSpace as {primaries?:unknown;transfer?:unknown}:{};
    const code=(index:number)=>parts.length===9&&/^\d{2}$/.test(parts[index])?String(Number(parts[index])):undefined;
    return {primaries:read(primaries,code(5))??read(primaries,space.primaries)??'bt709',
        transfer:read(transfer,code(6))??read(transfer,space.transfer)??'bt709'};
}

export function mp4Vp9ColorArgs(color: Mp4Vp9Color): string[] {
    return ['-color_primaries',color.primaries,'-color_trc',color.transfer];
}
