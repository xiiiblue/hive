import {defineConfig} from 'astro/config';
import sitemap from '@astrojs/sitemap';
export default defineConfig({site:'https://www.bluexiii.com',base:'/hive',trailingSlash:'always',output:'static',integrations:[sitemap({filter: page => !page.endsWith('/docs/product/capabilities/')})],build:{format:'directory'},server:{port:4327}});
