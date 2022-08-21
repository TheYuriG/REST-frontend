import React, { Component, Fragment } from 'react';
//? Import the websocket package
import openSocket from 'socket.io-client';

import Post from '../../components/Feed/Post/Post';
import Button from '../../components/Button/Button';
import FeedEdit from '../../components/Feed/FeedEdit/FeedEdit';
import Input from '../../components/Form/Input/Input';
import Paginator from '../../components/Paginator/Paginator';
import Loader from '../../components/Loader/Loader';
import ErrorHandler from '../../components/ErrorHandler/ErrorHandler';
import './Feed.css';
//? Import the server URL
import { server } from '../../util/server.js';
// import post from '../../components/Feed/Post/Post';

class Feed extends Component {
	state = {
		isEditing: false,
		posts: [],
		totalPosts: 0,
		editPost: null,
		status: '',
		postPage: 1,
		postsLoading: true,
		editLoading: false,
	};

	componentDidMount() {
		//? Make a network request for the logged-in user status
		fetch(server + '/auth/status', {
			headers: {
				Authorization: 'Bearer ' + this.props.token,
			},
		})
			.then((res) => {
				//? Throw an error if we get anything else other than 200 SUCCESS
				if (res.status !== 200) {
					throw new Error('Failed to fetch user status.');
				}
				//? Parse the user status response
				return res.json();
			})
			.then((resData) => {
				//? Pass the response to the state manager and render the status on the client UI
				resData = JSON.parse(resData);
				this.setState({ status: resData.status });
			})
			.catch(this.catchError);

		//? Once the page has loaded, request to pull the posts from the backend
		this.loadPosts();

		//? Opens the websocket connection to the backend
		const socket = openSocket(server, {
			transports: ['websocket', 'polling'],
			withCredentials: true,
		});
		//? Listen for 'posts' events on the websocket
		socket.on('posts', (data) => {
			//? Add new posts as they come
			if (data.action === 'create') {
				this.addPost(data.post);
			} //? Update posts as they get updated
			else if (data.action === 'update') {
				this.updatePost(data.post);
			}
			//? If a post was deleted, load the posts again
			else if (data.action === 'delete') {
				this.loadPosts();
			}
		});
	}

	//? This function will run once the websocket receives a push payload
	//? informing a new post was created by any user
	addPost = (post) => {
		this.setState((prevState) => {
			//? Store previous posts again
			const updatedPosts = [...prevState.posts];
			//? Check if we are on page 1 (no point in adding posts on UI if we are not there)
			if (prevState.postPage === 1) {
				//? Check if the maximum number of posts is being displayed
				if (this.state.posts.length === 10) {
					//? If we are displaying the max number of posts per page, destroy the oldest
					updatedPosts.pop();
				}
				//? Add the recently added post to the displayed posts
				updatedPosts.unshift(post);
			}
			//? Update the UI accordingly and increase the totalPosts count for pagination purposes
			return { posts: updatedPosts, totalPosts: prevState.totalPosts + 1 };
		});
	};

	//? This function runs every time the websocket receives an 'update' event
	updatePost = (post) => {
		this.setState((prevState) => {
			//? Fetch previous posts
			const updatedPosts = [...prevState.posts];
			//? Check if the post being updated is currently being displayed by the UI
			const updatedPostsIndex = updatedPosts.findIndex((p) => p._id === post._id);
			//? If the post is being displayed, update it
			if (updatedPostsIndex > -1) {
				updatedPosts[updatedPostsIndex] = post;
			}
			//? Return all posts, regardless if an update was done
			return {
				posts: updatedPosts,
			};
		});
	};

	loadPosts = (direction) => {
		if (direction) {
			this.setState({ postsLoading: true, posts: [] });
		}
		let page = this.state.postPage;
		if (direction === 'next') {
			page++;
			this.setState({ postPage: page });
		}
		if (direction === 'previous') {
			page--;
			this.setState({ postPage: page });
		}
		fetch(server + '/feed/posts?page=' + page, {
			headers: {
				Authorization: 'Bearer ' + this.props.token,
			},
		})
			.then((res) => {
				if (res.status !== 200) {
					throw new Error('Failed to fetch posts.');
				}
				return res.json();
			})
			.then((resData) => {
				this.setState({
					posts: resData.posts.map((post) => {
						return { ...post, imagePath: post.imageUrl };
					}),
					totalPosts: resData.totalItems,
					postsLoading: false,
				});
			})
			.catch(this.catchError);
	};

	statusUpdateHandler = (event) => {
		event.preventDefault();
		const formData = new FormData();
		formData.append('status', this.state.status);
		fetch(server + '/auth/status', {
			method: 'POST',
			body: formData,
			headers: {
				Authorization: 'Bearer ' + this.props.token,
			},
		})
			.then((res) => {
				if (res.status !== 200 && res.status !== 201) {
					throw new Error("Can't update status!");
				}
				return res.json();
			})
			.catch(this.catchError);
	};

	newPostHandler = () => {
		this.setState({ isEditing: true });
	};

	startEditPostHandler = (postId) => {
		this.setState((prevState) => {
			const loadedPost = { ...prevState.posts.find((p) => p._id === postId) };

			return {
				isEditing: true,
				editPost: loadedPost,
			};
		});
	};

	cancelEditHandler = () => {
		this.setState({ isEditing: false, editPost: null });
	};

	finishEditHandler = (postData) => {
		this.setState({
			editLoading: true,
		});
		//? Creates a form and upload 'title', 'content' and the image to the server
		const formData = new FormData();
		formData.append('title', postData.title);
		formData.append('content', postData.content);
		formData.append('image', postData.image);

		let url = server + '/feed/post';
		let method = 'POST';
		if (this.state.editPost) {
			url = server + '/feed/post/' + this.state.editPost._id;
			method = 'PUT';
		}

		fetch(url, {
			method: method,
			body: formData,
			headers: {
				Authorization: 'Bearer ' + this.props.token,
			},
		})
			.then((res) => {
				if (res.status !== 200 && res.status !== 201) {
					throw new Error('Creating or editing a post failed!');
				}
				return res.json();
			})
			.then((resData) => {
				const post = {
					_id: resData.post._id,
					title: resData.post.title,
					content: resData.post.content,
					creator: resData.post.creator,
					createdAt: resData.post.createdAt,
				};
				this.setState(() => {
					return {
						isEditing: false,
						editPost: null,
						editLoading: false,
					};
				});
			})
			.catch((err) => {
				console.log(err);
				this.setState({
					isEditing: false,
					editPost: null,
					editLoading: false,
					error: err,
				});
			});
	};

	statusInputChangeHandler = (input, value) => {
		this.setState({ status: value });
	};

	deletePostHandler = (postId) => {
		this.setState({ postsLoading: true });
		fetch(server + '/feed/post/' + postId, {
			method: 'DELETE',
			headers: {
				Authorization: 'Bearer ' + this.props.token,
			},
		})
			.then((res) => {
				if (res.status !== 200 && res.status !== 201) {
					throw new Error('Deleting a post failed!');
				}
				return res.json();
			})
			.then(() => {
				this.loadPosts();
			})
			.catch((err) => {
				console.log(err);
				this.setState({ postsLoading: false });
			});
	};

	errorHandler = () => {
		this.setState({ error: null });
	};

	catchError = (error) => {
		this.setState({ error: error });
	};

	render() {
		return (
			<Fragment>
				<ErrorHandler error={this.state.error} onHandle={this.errorHandler} />
				<FeedEdit
					editing={this.state.isEditing}
					selectedPost={this.state.editPost}
					loading={this.state.editLoading}
					onCancelEdit={this.cancelEditHandler}
					onFinishEdit={this.finishEditHandler}
				/>
				<section className="feed__status">
					<form onSubmit={this.statusUpdateHandler}>
						<Input
							type="text"
							placeholder="Your status"
							control="input"
							onChange={this.statusInputChangeHandler}
							value={this.state.status}
						/>
						<Button mode="flat" type="submit">
							Update
						</Button>
					</form>
				</section>
				<section className="feed__control">
					<Button mode="raised" design="accent" onClick={this.newPostHandler}>
						New Post
					</Button>
				</section>
				<section className="feed">
					{this.state.postsLoading && (
						<div style={{ textAlign: 'center', marginTop: '2rem' }}>
							<Loader />
						</div>
					)}
					{this.state.posts.length <= 0 && !this.state.postsLoading ? (
						<p style={{ textAlign: 'center' }}>No posts found.</p>
					) : null}
					{!this.state.postsLoading && (
						<Paginator
							onPrevious={this.loadPosts.bind(this, 'previous')}
							onNext={this.loadPosts.bind(this, 'next')}
							lastPage={Math.ceil(this.state.totalPosts / 2)}
							currentPage={this.state.postPage}
						>
							{this.state.posts.map((post) => (
								<Post
									key={post._id}
									id={post._id}
									author={post.creator.name}
									date={new Date(post.createdAt).toLocaleDateString('en-US')}
									title={post.title}
									image={post.imageUrl}
									content={post.content}
									onStartEdit={this.startEditPostHandler.bind(this, post._id)}
									onDelete={this.deletePostHandler.bind(this, post._id)}
								/>
							))}
						</Paginator>
					)}
				</section>
			</Fragment>
		);
	}
}

export default Feed;
