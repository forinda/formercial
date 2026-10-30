import { ConfigService, Controller, Get } from '@forinda/kickjs'
import { inertia } from '@forinda/kickjs-inertia'

@Controller()
export class PagesController {
  constructor(private readonly config: ConfigService) {}

  @Get('/')
  home() {
    // Renders src/client/pages/Home.tsx with these props.
    return inertia(
      'Home',
      { greeting: 'Welcome to commercial-x-creator' },
      // In the first HTML response, for search engines and link previews.
      {
        meta: {
          title: 'Home',
          // 120–160 characters reads best in search results.
          description:
            'Welcome to commercial-x-creator: a KickJS and Inertia app with server-rendered pages, typed forms for putting short commercials together.',
          jsonLd: {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'commercial-x-creator',
            url: this.config.get('APP_URL'),
          },
        },
      },
    )
  }
}
