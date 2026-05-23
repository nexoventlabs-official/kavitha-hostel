/**
 * Builds the Endpoint-mode Flow JSON for the Kavitha PG WhatsApp flow.
 *
 * Single flow, one screen. The backend INIT returns a SERVICE_SELECT screen
 * whose items depend on whether the contact is already a registered resident.
 *
 * All branches are terminal (`complete` action) — the webhook then dispatches
 * the matching follow-up WhatsApp message (PDF, register CTA, payment link,
 * contact card, etc).
 */
function buildFlowJSON() {
  return {
    version: '7.0',
    data_api_version: '3.0',
    routing_model: {
      SERVICE_SELECT: [],
    },
    screens: [
      {
        id: 'SERVICE_SELECT',
        title: 'Choose Service',
        terminal: true,
        success: true,
        data: {
          welcome_banner: { type: 'string', __example__: 'iVBORw0KGgo' },
          has_welcome_banner: { type: 'boolean', __example__: false },
          heading: { type: 'string', __example__: 'Choose Service' },
          subheading: { type: 'string', __example__: 'Tap a service to continue.' },
          services: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                description: { type: 'string' },
                image: { type: 'string' },
              },
            },
            __example__: [
              { id: 'register', title: 'Register', description: 'Join Kavitha PG' },
              { id: 'per_month_cost', title: 'Per Month Cost', description: 'View pricing PDF' },
              { id: 'food_timings', title: 'Food Timings', description: 'Meal schedule' },
              { id: 'hostel_rules', title: 'Hostel Rules', description: 'House rules PDF' },
              { id: 'change_language', title: 'Change Language', description: 'English / Tamil' },
              { id: 'contact', title: 'Contact', description: 'Talk to our team' },
            ],
          },
        },
        layout: {
          type: 'SingleColumnLayout',
          children: [
            {
              type: 'Image',
              src: '${data.welcome_banner}',
              width: 1000,
              height: 125,
              'scale-type': 'cover',
              'alt-text': 'Kavitha PG',
              visible: '${data.has_welcome_banner}',
            },
            { type: 'TextHeading', text: '${data.heading}' },
            { type: 'TextBody', text: '${data.subheading}' },
            {
              type: 'RadioButtonsGroup',
              name: 'selected_service',
              label: 'Services',
              required: true,
              'data-source': '${data.services}',
            },
            {
              type: 'Footer',
              label: 'Continue',
              'on-click-action': {
                name: 'complete',
                payload: {
                  kind: 'service_pick',
                  selected_service: '${form.selected_service}',
                },
              },
            },
          ],
        },
      },
    ],
  };
}

module.exports = { buildFlowJSON };
