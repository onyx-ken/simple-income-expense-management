import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			// default options are shown. On some platforms
			// these options are set automatically — see below
			pages: 'build',
			assets: 'build',
			fallback: undefined,
			precompress: false,
			strict: true
		})
	},
	paths: {
		base: '', // 기본 경로 설정 (비워두면 루트 경로)
	},
	prerender: {
		default: true // 모든 경로를 정적 파일로 미리 렌더링
	},
	alias: {
		$lib: './src/lib'
	}
};

export default config;
