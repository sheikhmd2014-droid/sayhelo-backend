#!/usr/bin/env python3
"""
TikVerse Backend API Testing Suite
Tests all endpoints for the TikTok clone app
"""

import requests
import sys
import json
from datetime import datetime
import uuid

class TikVerseAPITester:
    def __init__(self, base_url="https://tiktok-clone-755.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.test_user_data = {
            "username": f"testuser_{datetime.now().strftime('%H%M%S')}",
            "email": f"test_{datetime.now().strftime('%H%M%S')}@example.com",
            "password": "TestPass123!"
        }
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.test_video_id = None

    def log_test(self, name, success, details=""):
        """Log test results"""
        self.tests_run += 1
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {name}")
        if details:
            print(f"    {details}")
        if success:
            self.tests_passed += 1
        else:
            self.failed_tests.append({"test": name, "details": details})

    def make_request(self, method, endpoint, data=None, expected_status=200, auth=True):
        """Make HTTP request with error handling"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if auth and self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)

            success = response.status_code == expected_status
            return success, response
        except Exception as e:
            return False, str(e)

    def test_health_check(self):
        """Test basic health endpoints"""
        print("\n🔍 Testing Health Endpoints...")
        
        # Test root endpoint
        success, response = self.make_request('GET', '', auth=False)
        if success:
            self.log_test("Root endpoint", True, f"Status: {response.status_code}")
        else:
            self.log_test("Root endpoint", False, f"Failed: {response}")

        # Test health endpoint
        success, response = self.make_request('GET', 'health', auth=False)
        if success:
            self.log_test("Health endpoint", True, f"Status: {response.status_code}")
        else:
            self.log_test("Health endpoint", False, f"Failed: {response}")

    def test_user_registration(self):
        """Test user registration"""
        print("\n🔍 Testing User Registration...")
        
        success, response = self.make_request(
            'POST', 'auth/register', 
            self.test_user_data, 
            expected_status=200,
            auth=False
        )
        
        if success:
            data = response.json()
            if 'access_token' in data and 'user' in data:
                self.token = data['access_token']
                self.user_id = data['user']['id']
                self.log_test("User registration", True, f"User ID: {self.user_id}")
            else:
                self.log_test("User registration", False, "Missing token or user data")
        else:
            self.log_test("User registration", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")

    def test_user_login(self):
        """Test user login"""
        print("\n🔍 Testing User Login...")
        
        login_data = {
            "email": self.test_user_data["email"],
            "password": self.test_user_data["password"]
        }
        
        success, response = self.make_request(
            'POST', 'auth/login', 
            login_data, 
            expected_status=200,
            auth=False
        )
        
        if success:
            data = response.json()
            if 'access_token' in data:
                self.log_test("User login", True, "Login successful")
            else:
                self.log_test("User login", False, "Missing access token")
        else:
            self.log_test("User login", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")

    def test_get_current_user(self):
        """Test get current user endpoint"""
        print("\n🔍 Testing Get Current User...")
        
        success, response = self.make_request('GET', 'auth/me')
        
        if success:
            data = response.json()
            if 'id' in data and 'username' in data:
                self.log_test("Get current user", True, f"Username: {data['username']}")
            else:
                self.log_test("Get current user", False, "Missing user data")
        else:
            self.log_test("Get current user", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")

    def test_video_upload(self):
        """Test video upload"""
        print("\n🔍 Testing Video Upload...")
        
        video_data = {
            "caption": "Test video upload from API test",
            "video_url": "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
            "thumbnail_url": "https://images.unsplash.com/photo-1576425992375-833883be0039?w=400"
        }
        
        success, response = self.make_request(
            'POST', 'videos', 
            video_data, 
            expected_status=200
        )
        
        if success:
            data = response.json()
            if 'id' in data:
                self.test_video_id = data['id']
                self.log_test("Video upload", True, f"Video ID: {self.test_video_id}")
            else:
                self.log_test("Video upload", False, "Missing video ID")
        else:
            self.log_test("Video upload", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")

    def test_video_feed(self):
        """Test video feed"""
        print("\n🔍 Testing Video Feed...")
        
        success, response = self.make_request('GET', 'videos/feed', auth=False)
        
        if success:
            data = response.json()
            if isinstance(data, list):
                self.log_test("Video feed", True, f"Found {len(data)} videos")
            else:
                self.log_test("Video feed", False, "Response is not a list")
        else:
            self.log_test("Video feed", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")

    def test_like_video(self):
        """Test like/unlike video"""
        print("\n🔍 Testing Video Like/Unlike...")
        
        if not self.test_video_id:
            self.log_test("Like video", False, "No test video available")
            return

        # Test like
        success, response = self.make_request(
            'POST', f'videos/{self.test_video_id}/like'
        )
        
        if success:
            self.log_test("Like video", True, "Video liked successfully")
            
            # Test unlike
            success, response = self.make_request(
                'DELETE', f'videos/{self.test_video_id}/like'
            )
            
            if success:
                self.log_test("Unlike video", True, "Video unliked successfully")
            else:
                self.log_test("Unlike video", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")
        else:
            self.log_test("Like video", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")

    def test_comments(self):
        """Test comment functionality"""
        print("\n🔍 Testing Comments...")
        
        if not self.test_video_id:
            self.log_test("Add comment", False, "No test video available")
            return

        # Test add comment
        comment_data = {"content": "Test comment from API test"}
        success, response = self.make_request(
            'POST', f'videos/{self.test_video_id}/comments',
            comment_data
        )
        
        if success:
            data = response.json()
            comment_id = data.get('id')
            self.log_test("Add comment", True, f"Comment ID: {comment_id}")
            
            # Test get comments
            success, response = self.make_request(
                'GET', f'videos/{self.test_video_id}/comments',
                auth=False
            )
            
            if success:
                comments = response.json()
                self.log_test("Get comments", True, f"Found {len(comments)} comments")
            else:
                self.log_test("Get comments", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")
        else:
            self.log_test("Add comment", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")

    def test_user_profile(self):
        """Test user profile endpoints"""
        print("\n🔍 Testing User Profile...")
        
        if not self.user_id:
            self.log_test("Get user profile", False, "No user ID available")
            return

        success, response = self.make_request(
            'GET', f'users/{self.user_id}',
            auth=False
        )
        
        if success:
            data = response.json()
            if 'username' in data:
                self.log_test("Get user profile", True, f"Username: {data['username']}")
            else:
                self.log_test("Get user profile", False, "Missing username")
        else:
            self.log_test("Get user profile", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")

    def test_follow_system(self):
        """Test follow/unfollow functionality"""
        print("\n🔍 Testing Follow System...")
        
        # Create a second user to follow
        second_user_data = {
            "username": f"followtest_{datetime.now().strftime('%H%M%S')}",
            "email": f"follow_{datetime.now().strftime('%H%M%S')}@example.com",
            "password": "TestPass123!"
        }
        
        success, response = self.make_request(
            'POST', 'auth/register',
            second_user_data,
            auth=False
        )
        
        if success:
            second_user = response.json()
            second_user_id = second_user['user']['id']
            
            # Test follow
            success, response = self.make_request(
                'POST', f'users/{second_user_id}/follow'
            )
            
            if success:
                self.log_test("Follow user", True, "User followed successfully")
                
                # Test unfollow
                success, response = self.make_request(
                    'DELETE', f'users/{second_user_id}/follow'
                )
                
                if success:
                    self.log_test("Unfollow user", True, "User unfollowed successfully")
                else:
                    self.log_test("Unfollow user", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")
            else:
                self.log_test("Follow user", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")
        else:
            self.log_test("Follow system setup", False, "Could not create second user")

    def test_search(self):
        """Test search functionality"""
        print("\n🔍 Testing Search...")
        
        # Test user search
        success, response = self.make_request(
            'GET', f'search/users?q={self.test_user_data["username"][:5]}',
            auth=False
        )
        
        if success:
            users = response.json()
            self.log_test("Search users", True, f"Found {len(users)} users")
        else:
            self.log_test("Search users", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")

        # Test video search
        success, response = self.make_request(
            'GET', 'search/videos?q=test',
            auth=False
        )
        
        if success:
            videos = response.json()
            self.log_test("Search videos", True, f"Found {len(videos)} videos")
        else:
            self.log_test("Search videos", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting TikVerse API Tests...")
        print(f"Backend URL: {self.base_url}")
        
        # Run tests in order
        self.test_health_check()
        self.test_user_registration()
        self.test_user_login()
        self.test_get_current_user()
        self.test_video_upload()
        self.test_video_feed()
        self.test_like_video()
        self.test_comments()
        self.test_user_profile()
        self.test_follow_system()
        self.test_search()
        
        # Print summary
        print(f"\n📊 Test Summary:")
        print(f"Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Tests Failed: {len(self.failed_tests)}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.failed_tests:
            print(f"\n❌ Failed Tests:")
            for test in self.failed_tests:
                print(f"  - {test['test']}: {test['details']}")
        
        return self.tests_passed == self.tests_run

if __name__ == "__main__":
    tester = TikVerseAPITester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)