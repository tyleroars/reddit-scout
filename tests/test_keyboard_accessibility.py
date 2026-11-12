"""Offline UI regression tests. See tests/README.md for setup."""
import json
import os
from pathlib import Path
import time
import unittest

from playwright.sync_api import expect, sync_playwright

PAGE = (Path(__file__).resolve().parents[1] / 'index.html').as_uri()


def fixture_posts():
    body = (
        'I would appreciate some thoughtful suggestions about the options that are available to me. '
        'I have been comparing different possibilities and would like to understand the practical next steps.'
    )
    return [
        {'id': 'one', 'title': 'Entry level opportunities', 'selftext': body,
         'permalink': '/r/careerguidance/comments/one/', 'created_utc': int(time.time())},
        {'id': 'two', 'title': 'Entry level opportunities in college', 'selftext': body,
         'permalink': '/r/careerguidance/comments/two/', 'created_utc': int(time.time())},
    ]


class KeyboardAccessibility(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.playwright = sync_playwright().start()
        options = {'headless': True}
        if os.environ.get('CHROMIUM_EXECUTABLE'):
            options['executable_path'] = os.environ['CHROMIUM_EXECUTABLE']
        cls.browser = cls.playwright.chromium.launch(**options)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()

    def setUp(self):
        self.page = self.browser.new_page()
        self.errors = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.route('**/*', self.route)
        self.page.goto(PAGE)

    def route(self, route):
        if route.request.url.startswith('https://winter-scene-815d.tyler-b24.workers.dev/'):
            route.fulfill(content_type='application/json', body=json.dumps({'posts': fixture_posts()}))
        elif route.request.url == PAGE:
            route.continue_()
        else:
            route.abort()  # Never contact Reddit or the deployed proxy.

    def tearDown(self):
        self.page.close()
        self.assertEqual(self.errors, [])

    def tab_to(self, locator):
        for _ in range(30):
            self.page.keyboard.press('Tab')
            if locator.evaluate('(el) => el === document.activeElement'):
                return
        self.fail('Control was not reachable with Tab')

    def load_posts_with_keyboard(self):
        self.tab_to(self.page.get_by_role('button', name='Fetch posts'))
        self.page.keyboard.press('Enter')
        expect(self.page.locator('.post-card')).to_have_count(2)

    def assert_focus_ring(self, locator):
        self.assertEqual(locator.evaluate('(el) => getComputedStyle(el).outlineStyle'), 'solid')
        self.assertEqual(locator.evaluate('(el) => getComputedStyle(el).outlineWidth'), '3px')

    def test_signal_toggles_keyboard_state_and_last_active_guard(self):
        self.load_posts_with_keyboard()
        group = self.page.get_by_role('group', name='Signals:')
        expect(group.get_by_role('button')).to_have_count(5)
        one = group.get_by_role('button', name='1 signal', exact=True)
        self.tab_to(one)
        self.assert_focus_ring(one)
        self.page.keyboard.press('Enter')
        expect(one).to_have_attribute('aria-pressed', 'false')
        expect(self.page.locator('.post-card')).to_have_count(1)
        expect(one).to_be_focused()
        self.page.keyboard.press('Space')
        expect(one).to_have_attribute('aria-pressed', 'true')
        expect(self.page.locator('.post-card')).to_have_count(2)
        for index in range(1, 5):
            self.page.keyboard.press('Tab')
            pill = group.get_by_role('button').nth(index)
            expect(pill).to_be_focused()
            self.page.keyboard.press('Space')
            expect(pill).to_have_attribute('aria-pressed', 'false')
        self.tab_to(one)
        self.page.keyboard.press('Enter')
        expect(one).to_have_attribute('aria-pressed', 'true')
        expect(self.page.locator('.pill.active')).to_have_count(1)
        expect(self.page.locator('.post-card')).to_have_count(1)
        two = group.get_by_role('button', name='2 signals', exact=True)
        two.click()
        expect(two).to_have_attribute('aria-pressed', 'true')
        expect(self.page.locator('.post-card')).to_have_count(2)

    def test_labeled_slider_and_selection_keyboard(self):
        slider = self.page.get_by_role('slider', name='Look back:')
        self.tab_to(slider)
        self.assert_focus_ring(slider)
        self.page.keyboard.press('ArrowLeft')
        expect(slider).to_have_value('23')
        expect(self.page.locator('#timeVal')).to_have_text('23 hours')
        self.load_posts_with_keyboard()
        checkbox = self.page.get_by_role('checkbox', name='Select post: Entry level opportunities', exact=True)
        self.tab_to(checkbox)
        self.page.keyboard.press('Space')
        expect(checkbox).to_be_checked()
        expect(self.page.locator('#card-one')).to_have_class('post-card selected')
        expect(self.page.locator('#statSelected')).to_have_text('1')
        expect(self.page.get_by_role('button', name='Open selected in tabs')).to_be_enabled()
        self.page.keyboard.press('Space')
        expect(checkbox).not_to_be_checked()
        expect(self.page.get_by_role('button', name='Open selected in tabs')).to_be_disabled()
        self.page.locator('#card-one .post-title').click()
        expect(checkbox).to_be_checked()

    def test_mobile_focus_and_filter_layout(self):
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.load_posts_with_keyboard()
        five = self.page.get_by_role('button', name='5 or more signals')
        self.tab_to(five)
        self.assert_focus_ring(five)
        self.page.keyboard.press('Space')
        expect(five).to_have_attribute('aria-pressed', 'false')
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'))


if __name__ == '__main__':
    unittest.main(verbosity=2)
