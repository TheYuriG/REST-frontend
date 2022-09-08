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
		const graphqlUserStatusQuery = {
			query: `
            {
                userStatus(userId: "${this.props.userId}")
            }`,
		};
		//? Make a network request for the logged-in user status
		fetch(server + '/graphql', {
			method: 'POST',
			headers: {
				Authorization: 'Bearer ' + this.props.token,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(graphqlUserStatusQuery),
		})
			.then((res) => {
				//? Parse the user status response
				return res.json();
			})
			.then(({ errors, data: { userStatus } }) => {
				//? Check if we got any errors
				if (errors) {
					//? Throw the default error message
					throw new Error('Failed to retrieve user status!');
				}
				//? Pass the response to the state manager and render the status on the client UI
				this.setState({ status: userStatus });
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
		const graphqlQueryPosts = {
			query: `
                {
                    posts(page: ${page}) {
                        posts {
                            _id
                            title
                            content
                            imageUrl
                            creator {
                                name
                            }
                            createdAt
                        }
                        totalPosts
                    }
                }
            `,
		};
		fetch(server + '/graphql', {
			method: 'POST',
			body: JSON.stringify(graphqlQueryPosts),
			headers: {
				Authorization: 'Bearer ' + this.props.token,
				'Content-Type': 'application/json',
			},
		})
			.then((res) => {
				return res.json();
			})
			.then(
				({
					errors,
					data: {
						posts: { posts, totalItems: totalPosts },
					},
				}) => {
					//? Check if we got any errors
					if (errors) {
						//? Check specifically if the server returned an
						//? Unauthorized status code and throw that error
						if (errors[0].status === 401) {
							throw new Error('Failed to post, you are not authenticated!');
						}

						//? If not, then throw the default error message
						throw new Error('Failed to fetch posts!');
					}

					this.setState({
						posts: posts.map((post) => {
							return { ...post, imagePath: post.imageUrl };
						}),
						totalPosts,
						postsLoading: false,
					});
				}
			)
			.catch(this.catchError);
	};

	statusUpdateHandler = (event) => {
		event.preventDefault();

		//? Build the GraphQL mutation query
		const graphqlStatusUpdateMutation = {
			query: `
            mutation {
                updateStatus(newStatus: "${this.state.status}")
            }`,
		};

		//? Request mutation to the GraphQL endpoint
		fetch(server + '/graphql', {
			method: 'POST',
			body: JSON.stringify(graphqlStatusUpdateMutation),
			headers: {
				Authorization: 'Bearer ' + this.props.token,
				'Content-Type': 'application/json',
			},
		})
			.then((res) => {
				//? Parse the response
				return res.json();
			})
			.then(({ errors, data: { updateStatus } }) => {
				//? Check if we got any errors
				if (errors) {
					//? Check if we got any errors
					if (errors) {
						//? Throw the default error message
						throw new Error('Failed to update user status!');
					}
				}
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

		const edit = this.state.editPost ? true : false;
		const _id = this.state.editPost ? this.state.editPost._id : null;

		//? Create a form where you can send the image to the backend
		const formData = new FormData();
		formData.append('image', postData.image);
		if (edit) {
			//? If we are editing a post, attach the old image location
			//? with the request so that image can be deleted if a new one
			//? is also being uploaded
			formData.append('oldPath', this.state.editPost.imagePath);
		}
		//? Send an image upload request to the '/uploads' REST endpoint on backend
		fetch(server + '/uploads', {
			method: 'PUT',
			headers: { Authorization: 'Bearer ' + this.props.token },
			body: formData,
		})
			.then((res) => {
				return res.json();
			})
			.then(({ filePath }) => {
				//? Creates an object that is later sent to the graphQL API on the server
				const graphqlQueryPostCreation = {
					query: `mutation {
                ${edit ? 'updatePost' : 'createPost'}(${edit ? 'renewPost' : 'postInput'}: {${
						edit ? 'ID: "' + this.state.editPost._id + '", ' : ''
					}title: "${postData.title}", content: "${
						postData.content
					}", imageUrl: "${filePath}"}) {
                    _id
                    title
                    content
                    imageUrl
                    creator {
                        name
                    }
                    createdAt
                }
            }
            `,
				};

				return fetch(server + '/graphql', {
					method: 'POST',
					body: JSON.stringify(graphqlQueryPostCreation),
					headers: {
						Authorization: 'Bearer ' + this.props.token,
						'Content-Type': 'application/json',
					},
				});
			})
			.then((res) => {
				return res.json();
			})
			.then(({ errors, data }) => {
				//? Check if we got any errors
				if (errors) {
					//? Check specifically if the server returned an
					//? Unauthorized status code and throw that error
					if (errors[0].status === 401) {
						throw new Error('Failed to post, you are not authenticated!');
					}

					//? If not, then throw the default error message
					throw new Error('Post creation failed!');
				}

				//? Create a soft variable to store data depending on the
				//? request that was completed (editing or creating a post)
				let destructedData;
				if (this.state.editPost) {
					//? If the post was edited, drill into 'data.updatePost'
					//? within the response object
					destructedData = data.updatePost;
				} else {
					//? If a post wasn't edited, then it was created. Instead,
					//? drill into 'data.createPost"
					destructedData = data.createPost;
				}
				//? Destructure the data we stored into 'destructedData' before
				const { _id, title, content, imagePath, creator, createdAt } = destructedData;

				//? Create an object with all the post data, so we can inject
				//? that into the state if needed
				const post = {
					_id,
					title,
					content,
					imageUrl: imagePath,
					creator,
					createdAt,
				};

				//? Check the state to see if we should render this specific post
				this.setState((previousState) => {
					//? Create a variable to store the current posts
					let updatedPosts = [...previousState.posts];

					//? If we are editing a post that is currently being displayed
					//? on screen, we need to update it after the editing is complete
					if (previousState.editPost) {
						//? Find where the post is on the user screen
						const postIndex = previousState.posts.findIndex(
							(p) => p._id === previousState.editPost._id
						);
						//? Update that specific post with the new updated information
						updatedPosts[postIndex] = post;
					} else if (previousState.postPage === 1) {
						//? If we are on page 1 and we are not editing a post, then we must
						//? be creating a new one. Since our posts are ordered from newest to
						//? oldest, this newly created post needs to be moved to the very top
						//? of our displayed posts list
						updatedPosts.unshift(post);
						//? If adding the new post overflows the page and disrespects the page
						//? limit, we must destroy the last post as it will now be on the
						//? next page instead
						if (updatedPosts.length > (previousState.postLimitPerPage || 10)) {
							updatedPosts.pop();
						}
					}
					//? Finally, update the screen with the new updated information, if needed
					return {
						posts: updatedPosts,
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
		const graphqlQueryPostDeletion = {
			query: `
            mutation {
                deletePost(ID: "${postId}")
            }`,
		};
		fetch(server + '/graphql', {
			method: 'POST',
			body: JSON.stringify(graphqlQueryPostDeletion),
			headers: {
				Authorization: 'Bearer ' + this.props.token,
				'Content-Type': 'application/json',
			},
		})
			.then((res) => {
				return res.json();
			})
			.then(({ errors, deletePost }) => {
				//? Check if we got any errors
				if (errors) {
					//? Check specifically if the server returned an
					//? Unauthorized status code and throw that error
					if (errors[0].status === 401) {
						throw new Error('Failed to delete post, you are not authenticated!');
					}

					//? If not, then throw the default error message
					throw new Error('Post deletion failed!');
				}
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
