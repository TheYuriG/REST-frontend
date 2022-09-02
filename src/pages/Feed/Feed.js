import React, { Component, Fragment } from 'react';

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
	}

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
		//? Creates an object that is later sent to the graphQL API on the server
		let graphqlQuery = {
			query: `
            mutation {
                createPost(postInput: {title: "${postData.title}", content: "${postData.content}", imageUrl: "${postData.image}"
                }   {
                    _id
                    title
                    content
                    imageUrl
                    creator {
                        name
                    }
                    createdAt
                    }
                )
            }
            `,
		};

		let url = server + '/graphql';
		let method = 'POST';
		if (this.state.editPost) {
			url = server + '/graphql';
			//this.state.editPost._id;
			method = 'PUT';
		}

		fetch(url, {
			method: method,
			body: graphqlQuery,
			headers: {
				Authorization: 'Bearer ' + this.props.token,
				'Content-Type': 'application/json',
			},
		})
			.then((res) => {
				return res.json();
			})
			.then(({ data: { createPost: resData } }) => {
				//? Check specifically if the server returned an
				//? Unauthorized status code and throw that error
				if (resData?.errors[0]?.status === 401) {
					throw new Error('Failed to post, you are not authenticated!');
				}
				//? If not, check if we got any errors and if so, throw that
				if (resData.errors) {
					throw new Error('Post creation failed!');
				}
				const post = {
					_id: resData._id,
					title: resData.title,
					content: resData.content,
					creator: resData.creator.name,
					createdAt: resData.createdAt,
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
