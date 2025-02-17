/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,svelte,js,ts}'],
	theme: {
		extend: {}
	},
	plugins: [
		require('daisyui'),
		function ({ addUtilities }) {
			addUtilities({
				'.text-outline': {
					textShadow: '2px 2px 0 #000, -2px -2px 0 #000, -2px 2px 0 #000, 2px -2px 0 #000'
				},
				'.text-outline-thin': {
					textShadow: '1px 1px 0 #000, -1px -1px 0 #000, -1px 1px 0 #000, 1px -1px 0 #000'
				}
			});
		}
	],
	daisyui: {
		themes: ['lofi', 'business'],
		darkTheme: 'business', // dark 모드에서 사용할 테마
		base: true,
		styled: true,
		utils: true,
		logs: true
	}
};
