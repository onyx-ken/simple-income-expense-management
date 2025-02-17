<script>
	import 'tailwindcss/tailwind.css';

</script>

<div class="app">
	<slot />
</div>

<style>
    @font-face {
        font-family: 'ONE-Mobile-POP';
        src: url('/fonts/ONE Mobile POP OTF.otf') format('opentype');
        font-weight: normal;
        font-style: normal;
    }

    :global(body) {
        font-family: 'ONE-Mobile-POP', Arial, sans-serif;
    }

    /* 스크롤바 항상 표시 */
    :global(html) {
        overflow: scroll;
        scrollbar-gutter: stable both-edges; /* 스크롤바 공간 유지 */
    }
</style>
